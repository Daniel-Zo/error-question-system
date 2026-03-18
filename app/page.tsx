'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Link from 'next/link';
import { getAllTags } from '../lib/tags';
import { format, subDays } from 'date-fns';
import zhCN from 'date-fns/locale/zh-CN';

// 定义类型
interface ErrorQuestion {
  id: string;
  question_content: string;
  tag_ids: string[];
  tag_names?: string[];
  question_image_url: string;
  error_reason: string;
  correct_answer: string;
  correct_answer_image_url: string;
  create_time: string;
  error_question_logs: { count: number } | null;
}

interface Tag {
  id: string;
  name: string;
}

export default function Home() {
  const [errorQuestions, setErrorQuestions] = useState<ErrorQuestion[]>([]);
  const [filteredQuestions, setFilteredQuestions] = useState<ErrorQuestion[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // 查询条件
  const [searchText, setSearchText] = useState('');
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  // 获取所有标签和错题
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // 获取标签列表
        const tagList = await getAllTags();
        setTags(tagList);

        // 获取所有错题
        const { data, error } = await supabase
          .from('error_questions')
          .select(`
            *,
            error_question_logs(count)
          `)
          .order('create_time', { ascending: false });

        if (error) throw error;
        
        // 关联标签名称
        const questionsWithTags = (data || []).map(question => ({
          ...question,
          tag_names: question.tag_ids.map(tagId => 
            tagList.find(tag => tag.id === tagId)?.name || ''
          ).filter(Boolean)
        }));
        
        setErrorQuestions(questionsWithTags);
        setFilteredQuestions(questionsWithTags);
      } catch (error) {
        console.error('获取数据失败:', error);
        alert('获取数据失败，请刷新页面重试');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // 筛选错题
  useEffect(() => {
    if (errorQuestions.length === 0) return;

    const filtered = errorQuestions.filter(question => {
      // 1. 题目内容筛选
      const matchesText = searchText === '' || 
        question.question_content.toLowerCase().includes(searchText.toLowerCase());
      
      // 2. 时间筛选
      const questionDate = new Date(question.create_time);
      const start = new Date(`${startDate} 00:00:00`);
      const end = new Date(`${endDate} 23:59:59`);
      const matchesDate = questionDate >= start && questionDate <= end;
      
      // 3. 标签筛选
      const matchesTags = selectedTagIds.length === 0 || 
        selectedTagIds.some(tagId => question.tag_ids.includes(tagId));

      return matchesText && matchesDate && matchesTags;
    });

    setFilteredQuestions(filtered);
  }, [errorQuestions, searchText, startDate, endDate, selectedTagIds]);

  // 切换标签选中状态
  const toggleTag = (tagId: string) => {
    setSelectedTagIds(prev => 
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  // 重置筛选条件
  const resetFilters = () => {
    setSearchText('');
    setStartDate(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
    setEndDate(format(new Date(), 'yyyy-MM-dd'));
    setSelectedTagIds([]);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto">
        {/* 页面头部 */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-4 md:mb-0">错题管理系统</h1>
            <div className="flex flex-wrap gap-3">
              <Link 
                href="/add-question" 
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg transition-all shadow-md hover:shadow-lg"
              >
                添加错题
              </Link>
              <Link 
                href="/daily-practice" 
                className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg transition-all shadow-md hover:shadow-lg"
              >
                每日一练
              </Link>
              <Link 
                href="/stats" 
                className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2 rounded-lg transition-all shadow-md hover:shadow-lg"
              >
                错题统计
              </Link>
            </div>
          </div>

          {/* 查询区域 */}
          <div className="bg-gray-50 rounded-lg p-4 border">
            <h2 className="text-lg font-medium text-gray-700 mb-4">错题查询</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 题目内容搜索 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">题目内容</label>
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="输入题目内容关键词"
                />
              </div>

              {/* 时间范围 */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">开始日期</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">结束日期</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex items-end gap-2">
                <button
                  onClick={resetFilters}
                  className="flex-1 px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-all"
                >
                  重置
                </button>
              </div>
            </div>

            {/* 标签筛选 */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">知识点标签</label>
              <div className="flex flex-wrap gap-2">
                {tags.map(tag => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className={`px-3 py-1 rounded-full text-sm transition-all ${
                      selectedTagIds.includes(tag.id)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                    }`}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 错题列表 */}
        {isLoading ? (
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <p className="text-lg text-gray-500">加载中...</p>
          </div>
        ) : filteredQuestions.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <p className="text-lg text-gray-500">暂无符合条件的错题</p>
            <Link 
              href="/add-question" 
              className="inline-block mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-all"
            >
              立即添加错题
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredQuestions.map((question) => (
              <div key={question.id} className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all overflow-hidden">
                <div className="p-5">
                  {/* 题目内容 */}
                  <h3 className="text-lg font-semibold text-gray-800 mb-2 line-clamp-2">
                    {question.question_content || '无题目内容'}
                  </h3>
                  
                  {/* 题目图片 */}
                  {question.question_image_url && (
                    <div className="my-3">
                      <img 
                        src={question.question_image_url} 
                        alt="题目图片" 
                        className="w-full h-auto max-h-40 object-contain rounded-lg border"
                      />
                    </div>
                  )}
                  
                  {/* 标签 */}
                  <div className="flex flex-wrap gap-1 mb-3">
                    {question.tag_names?.map(tag => (
                      <span key={tag} className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                  
                  {/* 错误原因 */}
                  {question.error_reason && (
                    <div className="text-sm text-gray-600 mb-2">
                      <span className="font-medium">错误原因：</span>
                      {question.error_reason}
                    </div>
                  )}
                  
                  {/* 练习次数 */}
                  <div className="text-sm text-gray-500 mb-3">
                    练习次数：{question.error_question_logs?.count || 0}
                  </div>
                  
                  {/* 添加时间 */}
                  <div className="text-xs text-gray-400">
                    添加时间：{new Date(question.create_time).toLocaleString('zh-CN')}
                  </div>
                </div>
                
                {/* 底部信息 */}
                <div className="bg-gray-50 px-5 py-3 border-t flex justify-between items-center">
                  <span className="text-xs text-gray-500">ID: {question.id.substring(0, 8)}</span>
                  {question.correct_answer_image_url && (
                    <span className="text-xs text-green-600">
                      ✔ 有答案图片
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}