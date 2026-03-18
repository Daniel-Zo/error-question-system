'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import Tesseract from 'tesseract.js';
import Link from 'next/link';
import { getAllTags, addNewTag } from '../../lib/tags';

// 表单验证规则
const errorQuestionSchema = z.object({
  questionContent: z.string().optional(),
  tagIds: z.array(z.string()).min(1, '至少选择一个知识点标签'),
  newTagName: z.string().optional(),
  errorReason: z.string().optional(),
  correctAnswer: z.string().optional(),
});

type ErrorQuestionFormData = z.infer<typeof errorQuestionSchema>;

export default function AddQuestion() {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [correctAnswerImageUrl, setCorrectAnswerImageUrl] = useState<string>('');
  const [tags, setTags] = useState<{ id: string; name: string }[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingAnswer, setIsUploadingAnswer] = useState(false);
  const router = useRouter();

  // 初始化表单
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<ErrorQuestionFormData>({
    resolver: zodResolver(errorQuestionSchema),
    defaultValues: { tagIds: [] }
  });

  const newTagName = watch('newTagName');

  // 获取标签列表
  useEffect(() => {
    const fetchTags = async () => {
      const tagList = await getAllTags();
      setTags(tagList);
    };
    fetchTags();
  }, []);

  // 处理题目图片上传 + OCR识别
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
      const fileName = `question_${Date.now()}_${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from('error_question_images')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('题目图片上传错误:', uploadError);
        throw uploadError;
      }

      // 获取图片URL
      const { data: urlData } = supabase
        .storage
        .from('error_question_images')
        .getPublicUrl(uploadData.path);
      setImageUrl(urlData.publicUrl);
      alert('题目图片上传成功，文字已识别！');
    } catch (error) {
      console.error('上传失败详情:', error);
      alert(`题目图片上传失败，但文字已识别。错误：${(error as Error).message}`);
    } finally {
      setIsOcrLoading(false);
      setIsUploading(false);
    }
  };

  // 处理正确答案图片上传
  const handleAnswerImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAnswer(true);
    try {
      // 上传图片到Supabase存储
      const fileName = `answer_${Date.now()}_${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from('error_question_images')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('答案图片上传错误:', uploadError);
        throw uploadError;
      }

      // 获取图片URL
      const { data: urlData } = supabase
        .storage
        .from('error_question_images')
        .getPublicUrl(uploadData.path);
      setCorrectAnswerImageUrl(urlData.publicUrl);
      alert('正确答案图片上传成功！');
    } catch (error) {
      console.error('答案图片上传失败:', error);
      alert(`正确答案图片上传失败：${(error as Error).message}`);
    } finally {
      setIsUploadingAnswer(false);
    }
  };

  // 添加新标签
  const handleAddNewTag = async () => {
    if (!newTagName || newTagName.trim() === '') return;
    
    const tagId = await addNewTag(newTagName);
    if (tagId) {
      // 更新标签列表和选中状态
      const newTag = { id: tagId, name: newTagName.trim() };
      setTags([...tags, newTag]);
      setSelectedTags([...selectedTags, tagId]);
      setValue('newTagName', '');
    }
  };

  // 切换标签选中状态
  const toggleTag = (tagId: string) => {
    setSelectedTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId) 
        : [...prev, tagId]
    );
    setValue('tagIds', selectedTags.includes(tagId) 
      ? selectedTags.filter(id => id !== tagId) 
      : [...selectedTags, tagId]
    );
  };

  // 提交错题
  const onSubmit = async (data: ErrorQuestionFormData) => {
    try {
      // 准备提交数据
      const submitData = {
        question_content: data.questionContent || '',
        tag_ids: selectedTags,
        question_image_url: imageUrl,
        error_reason: data.errorReason || '',
        correct_answer: data.correctAnswer || '',
        correct_answer_image_url: correctAnswerImageUrl
      };

      const { error } = await supabase
        .from('error_questions')
        .insert([submitData]);

      if (error) throw error;
      alert('错题添加成功！');
      router.push('/');
    } catch (error) {
      alert(`添加失败：${(error as Error).message}`);
      console.error('添加错题错误:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto max-w-3xl">
        {/* 返回按钮 */}
        <div className="mb-6">
          <Link 
            href="/" 
            className="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors font-medium"
          >
            ← 返回主页
          </Link>
        </div>

        {/* 表单卡片 */}
        <div className="bg-white rounded-xl shadow-lg p-6 md:p-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6">添加错题</h1>
          
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* 题目图片上传 */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                题目图片（可选，自动识别文字）
              </label>
              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="block w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-lg file:border-0
                    file:bg-blue-50 file:text-blue-700
                    hover:file:bg-blue-100
                    transition-all"
                  disabled={isOcrLoading || isUploading}
                />
                {isOcrLoading && (
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-600 text-sm">
                    识别中...
                  </span>
                )}
                {isUploading && (
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-600 text-sm">
                    上传中...
                  </span>
                )}
              </div>
              {imageUrl && (
                <div className="mt-3">
                  <p className="text-sm text-gray-500 mb-2">已上传图片预览：</p>
                  <img 
                    src={imageUrl} 
                    alt="题目预览" 
                    className="rounded-lg max-w-full h-auto max-h-60 object-contain border"
                  />
                </div>
              )}
            </div>

            {/* 题目内容 */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                题目内容（可选）
              </label>
              <textarea
                {...register('questionContent')}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                placeholder="题目内容（图片识别后会自动填充）"
              />
              {errors.questionContent && (
                <p className="text-red-500 text-sm">{errors.questionContent.message}</p>
              )}
            </div>

            {/* 知识点标签 */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                知识点标签（必填）
              </label>
              
              {/* 已存在的标签 */}
              <div className="flex flex-wrap gap-2 mb-3">
                {tags.map(tag => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className={`px-3 py-1 rounded-full text-sm transition-all ${
                      selectedTags.includes(tag.id)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                    }`}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
              
              {/* 添加新标签 */}
              <div className="flex gap-2">
                <input
                  {...register('newTagName')}
                  type="text"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="输入新标签名并点击添加"
                />
                <button
                  type="button"
                  onClick={handleAddNewTag}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-all"
                >
                  添加标签
                </button>
              </div>
              
              {errors.tagIds && (
                <p className="text-red-500 text-sm">{errors.tagIds.message}</p>
              )}
            </div>

            {/* 错误原因 */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                错误原因（可选）
              </label>
              <input
                {...register('errorReason')}
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="例如：粗心大意,知识点未掌握"
              />
            </div>

            {/* 正确答案文字 */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                正确答案（可选）
              </label>
              <textarea
                {...register('correctAnswer')}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="请输入正确答案"
              />
            </div>

            {/* 正确答案图片 */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                正确答案图片（可选）
              </label>
              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAnswerImageUpload}
                  className="block w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-lg file:border-0
                    file:bg-green-50 file:text-green-700
                    hover:file:bg-green-100
                    transition-all"
                  disabled={isUploadingAnswer}
                />
                {isUploadingAnswer && (
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-green-600 text-sm">
                    上传中...
                  </span>
                )}
              </div>
              {correctAnswerImageUrl && (
                <div className="mt-3">
                  <p className="text-sm text-gray-500 mb-2">答案图片预览：</p>
                  <img 
                    src={correctAnswerImageUrl} 
                    alt="答案预览" 
                    className="rounded-lg max-w-full h-auto max-h-60 object-contain border"
                  />
                </div>
              )}
            </div>

            {/* 提交按钮 */}
            <div className="pt-2">
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-all shadow-md hover:shadow-lg"
              >
                保存错题
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}