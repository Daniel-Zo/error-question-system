'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Tesseract from 'tesseract.js';

// Form validation schema
const errorQuestionSchema = z.object({
  questionContent: z.string().min(1, 'Question content cannot be empty'),
  knowledgePoints: z.string().min(1, 'Knowledge points cannot be empty (separate multiple with commas)'),
  errorReason: z.string().optional(),
  correctAnswer: z.string().optional(),
});

type ErrorQuestionFormData = z.infer<typeof errorQuestionSchema>;

export default function AddQuestion() {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const router = useRouter();

  // Initialize form
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<ErrorQuestionFormData>({
    resolver: zodResolver(errorQuestionSchema),
  });

  // Image upload + OCR recognition
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsOcrLoading(true);
    // Step 1: OCR recognize text from image
    try {
      const { data: { text } } = await Tesseract.recognize(file, 'chi_sim');
      setValue('questionContent', text);
    } catch (error) {
      alert('OCR recognition failed, please enter the question manually');
      console.error('OCR error:', error);
    }

    // Step 2: Upload image to Supabase storage (optional)
    try {
      setIsUploading(true);
      const fileName = `error_question_${Date.now()}_${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from('error_question_images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get image URL
      const { data: urlData } = supabase
        .storage
        .from('error_question_images')
        .getPublicUrl(uploadData.path);
      setImageUrl(urlData.publicUrl);
    } catch (error) {
      alert('Image upload failed, but question content has been recognized');
      console.error('Upload error:', error);
    } finally {
      setIsOcrLoading(false);
      setIsUploading(false);
    }
  };

  // Submit error question
  const onSubmit = async (data: ErrorQuestionFormData) => {
    try {
      // Process knowledge points (convert comma-separated string to array)
      const knowledgePointsArray = data.knowledgePoints.split(',').map(tag => tag.trim());

      const { error } = await supabase
        .from('error_questions')
        .insert({
          question_content: data.questionContent,
          question_image_url: imageUrl,
          knowledge_points: knowledgePointsArray,
          error_reason: data.errorReason,
          correct_answer: data.correctAnswer,
        });

      if (error) throw error;
      alert('Error question added successfully!');
      router.push('/');
    } catch (error) {
      alert('Add failed: ' + (error as Error).message);
      console.error('Add error question error:', error);
    }
  };

  return (
    <div className="container mx-auto py-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-6">Add Error Question</h1>
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Image upload + OCR */}
        <div>
          <label className="block text-sm font-medium mb-1">Upload Question Image (Auto Recognition)</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="border p-2 rounded w-full"
            disabled={isOcrLoading || isUploading}
          />
          {isOcrLoading && <p className="text-sm text-blue-500 mt-1">Recognizing text from image...</p>}
          {isUploading && <p className="text-sm text-blue-500 mt-1">Uploading image...</p>}
        </div>

        {/* Question Content */}
        <div>
          <label className="block text-sm font-medium mb-1">Question Content</label>
          <textarea
            {...register('questionContent')}
            rows={4}
            className="border p-2 rounded w-full"
            placeholder="Enter question content (will be auto-filled after OCR recognition)"
          />
          {errors.questionContent && (
            <p className="text-red-500 text-sm mt-1">{errors.questionContent.message}</p>
          )}
        </div>

        {/* Knowledge Points */}
        <div>
          <label className="block text-sm font-medium mb-1">Knowledge Points (separate multiple with commas)</label>
          <input
            {...register('knowledgePoints')}
            type="text"
            className="border p-2 rounded w-full"
            placeholder="e.g., Primary Math, Addition and Subtraction, Application Problems"
          />
          {errors.knowledgePoints && (
            <p className="text-red-500 text-sm mt-1">{errors.knowledgePoints.message}</p>
          )}
        </div>

        {/* Error Reason */}
        <div>
          <label className="block text-sm font-medium mb-1">Error Reason (Optional)</label>
          <input
            {...register('errorReason')}
            type="text"
            className="border p-2 rounded w-full"
            placeholder="e.g., Careless mistake, Unmastered knowledge point"
          />
        </div>

        {/* Correct Answer */}
        <div>
          <label className="block text-sm font-medium mb-1">Correct Answer (Optional)</label>
          <textarea
            {...register('correctAnswer')}
            rows={2}
            className="border p-2 rounded w-full"
            placeholder="Enter correct answer"
          />
        </div>

        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded w-full"
        >
          Save Error Question
        </button>
      </form>
    </div>
  );
}