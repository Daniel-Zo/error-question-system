'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import Tesseract from 'tesseract.js';

// 表单验证规则
const errorQuestionSchema = z.object({
  questionContent: z.string().min(1, '题目内容不能为空'),
  knowledgePoints: z.string().min(1, '知识点不能为空（多个知识点用逗号分隔）'),
  errorReason: z.string().optional(),
  correctAnswer: z.string().optional(),
});

type ErrorQuestionFormData = z.infer<typeof errorQuestionSchema>;

export default function AddQuestion() {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const router = useRouter();

  // 初始化表单
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<ErrorQuestionFormData>({
    resolver: zodResolver(errorQuestionSchema),
  });

  // 图片上传 + OCR识别
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsOcrLoading(true);
    try {
      // OCR识别图片文字
      const { data: { text } } = await Tesseract.recognize(file, 'chi_sim');
      setValue('questionContent', text);

      // 上传图片到Supabase存储
      setIsUploading(true);
      const fileName = `error_question_${Date.now()}_${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from('error_question_images')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Supabase上传错误:', uploadError);
        throw uploadError;
      }

      // 获取图片URL
      const { data: urlData } = supabase
        .storage
        .from('error_question_images')
        .getPublicUrl(uploadData.path);
      setImageUrl(urlData.publicUrl);
      alert('图片上传成功，题目内容已识别！');
    } catch (error) {
      console.error('上传失败详情:', error);
      alert(`图片上传失败，但题目内容已识别。错误：${(error as Error).message}`);
    } finally {
      setIsOcrLoading(false);
      setIsUploading(false);
    }
  };

  // 提交错题
  const onSubmit = async (data: ErrorQuestionFormData) => {
    try {
      // 处理知识点（逗号分隔转数组）
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
      alert('错题添加成功！');
      router.push('/');
    } catch (error) {
      alert(`添加失败：${(error as Error).message}`);
      console.error('添加错题错误:', error);
    }
  };

  return (
    <div className="container mx-auto py-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-6">添加错题</h1>
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* 图片上传 + OCR */}
        <div>
          <label className="block text-sm font-medium mb-1">上传题目图片（自动识别文字）</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="border p-2 rounded w-full"
            disabled={isOcrLoading || isUploading}
          />
          {isOcrLoading && <p className="text-sm text-blue-500 mt-1">正在识别图片文字...</p>}
          {isUploading && <p className="text-sm text-blue-500 mt-1">正在上传图片...</p>}
        </div>

        {/* 题目内容 */}
        <div>
          <label className="block text-sm font-medium mb-1">题目内容</label>
          <textarea
            {...register('questionContent')}
            rows={4}
            className="border p-2 rounded w-full"
            placeholder="请输入题目内容（图片识别后会自动填充）"
          />
          {errors.questionContent && (
            <p className="text-red-500 text-sm mt-1">{errors.questionContent.message}</p>
          )}
        </div>

        {/* 知识点 */}
        <div>
          <label className="block text-sm font-medium mb-1">知识点（多个知识点用逗号分隔）</label>
          <input
            {...register('knowledgePoints')}
            type="text"
            className="border p-2 rounded w-full"
            placeholder="例如：小学数学,加减法,应用题"
          />
          {errors.knowledgePoints && (
            <p className="text-red-500 text-sm mt-1">{errors.knowledgePoints.message}</p>
          )}
        </div>

        {/* 错误原因 */}
        <div>
          <label className="block text-sm font-medium mb-1">错误原因（可选）</label>
          <input
            {...register('errorReason')}
            type="text"
            className="border p-2 rounded w-full"
            placeholder="例如：粗心大意,知识点未掌握"
          />
        </div>

        {/* 正确答案 */}
        <div>
          <label className="block text-sm font-medium mb-1">正确答案（可选）</label>
          <textarea
            {...register('correctAnswer')}
            rows={2}
            className="border p-2 rounded w-full"
            placeholder="请输入正确答案"
          />
        </div>

        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded w-full"
        >
          保存错题
        </button>
      </form>
    </div>
  );
}