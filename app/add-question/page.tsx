'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getAllTags, createTag } from '../lib/tags';
import { useRouter } from 'next/navigation';

interface Tag {
  id: string;
  name: string;
}

// 上传图片到Supabase存储
const uploadImage = async (file: File, folder = 'questions') => {
  if (!file) return null;
  
  const fileName = `${Date.now()}-${file.name}`;
  const filePath = `${folder}/${fileName}`;
  
  const { data, error } = await supabase.storage
    .from('error_question_images')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    });
  
  if (error) {
    console.error('上传失败:', error);
    alert('图片上传失败，请重试');
    return null;
  }
  
  // 获取图片URL
  const { data: urlData } = await supabase.storage
    .from('error_question_images')
    .getPublicUrl(filePath);
  
  return urlData.publicUrl;
};

export default function AddQuestion() {
  const router = useRouter();
  const [tags, setTags] = useState<Tag[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // 表单状态
  const [formData, setFormData] = useState({
    question_content: '',
    error_reason: '',
    correct_answer: '',
    tag_ids: [] as string[],
    question_image: null as File | null,
    correct_answer_image: null as File | null,
    question_image_url: '',
    correct_answer_image_url: ''
  });

  // 获取标签列表
  useEffect(() => {
    const fetchTags = async () => {
      const tagList = await getAllTags();
      setTags(tagList);
    };
    fetchTags();
  }, []);

  // 处理图片选择
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'question' | 'answer') => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (type === 'question') {
      setFormData(prev => ({ ...prev, question_image: file }));
    } else {
      setFormData(prev => ({ ...prev, correct_answer_image: file }));
    }
  };

  // 切换标签选择
  const toggleTag = (tagId: string) => {
    setFormData(prev => ({
      ...prev,
      tag_ids: prev.tag_ids.includes(tagId)
        ? prev.tag_ids.filter(id => id !== tagId)
        : [...prev.tag_ids, tagId]
    }));
  };

  // 创建新标签
  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    
    // 检查标签是否已存在
    const exists = tags.some(tag => tag.name.toLowerCase() === newTagName.toLowerCase().trim());
    if (exists) {
      alert('该标签已存在');
      return;
    }
    
    const newTag = await createTag(newTagName.trim());
    if (newTag) {
      setTags(prev => [...prev, newTag]);
      setNewTagName('');
      // 自动选中新标签
      toggleTag(newTag.id);
    }
  };

  // 提交表单
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.question_content.trim()) {
      alert('请输入题目内容');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // 1. 上传图片
      let questionImageUrl = '';
      let answerImageUrl = '';
      
      if (formData.question_image) {
        questionImageUrl = await uploadImage(formData.question_image) || '';
      }
      
      if (formData.correct_answer_image) {
        answerImageUrl = await uploadImage(formData.correct_answer_image, 'answers') || '';
      }
      
      // 2. 创建错题记录
      const { data, error } = await supabase
        .from('error_questions')
        .insert([
          {
            question_content: formData.question_content,
            error_reason: formData.error_reason,
            correct_answer: formData.correct_answer,
            tag_ids: formData.tag_ids,
            question_image_url: questionImageUrl,
            correct_answer_image_url: answerImageUrl,
            create_time: new Date().toISOString()
          }
        ])
        .select();
      
      if (error) throw error;
      
      alert('错题添加成功！');
      router.push('/');
    } catch (error) {
      console.error('添加失败:', error);
      alert('添加失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* 大标题 */}
        <h1 className="text-4xl font-bold text-gray-900 mb-8">添加新错题</h1>
        
        {/* 表单卡片 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 题目内容 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                题目内容 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.question_content}
                onChange={(e) => setFormData({...formData, question_content: e.target.value})}
                className="w-full px-4 py-3 text-lg border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={4}
                placeholder="请输入完整的题目内容"
                required
              />
            </div>

            {/* 错误原因 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                错误原因
              </label>
              <textarea
                value={formData.error_reason}
                onChange={(e) => setFormData({...formData, error_reason: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                rows={2}
                placeholder="请描述错误原因"
              />
            </div>

            {/* 正确答案 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                正确答案
              </label>
              <textarea
                value={formData.correct_answer}
                onChange={(e) => setFormData({...formData, correct_answer: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                rows={2}
                placeholder="请输入正确答案"
              />
            </div>

            {/* 知识点标签 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                知识点标签
              </label>
              
              {/* 现有标签 */}
              <div className="flex flex-wrap gap-2 mb-4">
                {tags.map(tag => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className={`px-3 py-1 rounded-full text-sm ${
                      formData.tag_ids.includes(tag.id) 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
              
              {/* 添加新标签 */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="输入新标签名称"
                />
                <button
                  type="button"
                  onClick={handleCreateTag}
                  className="px-4 py-2 text-white bg-green-600 rounded-md hover:bg-green-700"
                >
                  添加标签
                </button>
              </div>
            </div>

            {/* 题目图片 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                题目图片
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleImageChange(e, 'question')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>

            {/* 答案图片 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                答案图片
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleImageChange(e, 'answer')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>

            {/* 提交按钮 */}
            <div className="flex gap-4">
              <button
                type="submit"
                disabled={isLoading}
                className="px-8 py-3 text-lg font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
              >
                {isLoading ? '提交中...' : '保存错题'}
              </button>
              <button
                type="button"
                onClick={() => router.push('/')}
                className="px-8 py-3 text-lg font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                取消
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}