'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Link from 'next/link';
import { getAllTags } from '../lib/tags';
// 日期处理函数
import format from 'date-fns/format';
import subDays from 'date-fns/subDays';

// 定义核心类型
interface Tag {
  id: string;
  name: string;
}

interface ErrorQuestion {
  id: string;
  question_content: string;
  tag_ids: string[];
  tag_names?: string[];
  create_time: string;
  practice_count: number; // 练习次数
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

  // 获取所有标签和错题数据
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // 1. 获取标签列表
        const tagList = await getAllTags();
        setTags(tagList);

        // 2. 获取错题基础信息（仅核心字段）
        const { data: questionData } = await supabase
          .from('error_questions')
          .select(`
            id,
            question_content,
            tag_ids,
            create_time
          `)
          .order('create_time', { ascending: false });

        // 3. 补充每道题的练习次数
        const questionsWithPracticeCount = await Promise.all(
          (questionData || []).map(async (item) => {
            // 查询练习次数
            const { count: practiceCount } = await supabase
              .from('error_question_logs')
              .select('*', { count: 'exact', head: true })
              .eq('question_id', item.id);

            // 关联标签名称
            return {
              id: item.id,
              question_content: item.question_content || '',
              tag_ids: item.tag_ids || [],
              tag_names: item.tag_ids.map((tagId: string) => 
                tagList.find(tag => tag.id === tagId)?.name || ''
              ).filter(Boolean),
              create_time: item.create_time,
              practice_count: practiceCount || 0
            };
          })
        );

        setErrorQuestions(questionsWithPracticeCount);
        setFilteredQuestions(questionsWithPracticeCount);
      } catch (error) {
        console.error('获取数据失败:', error);
        alert('获取数据失败，请刷新页面重试');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // 筛选逻辑
  useEffect(() => {
    if (errorQuestions.length === 0) return;

    const filtered = errorQuestions.filter(question => {
      // 1. 题目内容关键词筛选
      const matchesText = searchText === '' || 
        question.question_content.toLowerCase().includes(searchText.toLowerCase());
      
      // 2. 时间范围筛选
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

  // 格式化日期显示
  const formatDisplayDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN');
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto">
        {/* 页面头部 */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800 mb-4 md:mb-0">错题管理系统</h1>
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

          {/* 查询筛选区域 */}
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
                {tags.map((tag: Tag) => (
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

        {/* 错题表格一览 */}
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
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      序号
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      题目ID
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      题目内容
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      知识点标签
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      练习次数
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      添加时间
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredQuestions.map((question, index) => (
                    <tr key={question.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {index + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                        {question.id.substring(0, 8)}... {/* 缩短ID显示 */}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-xl truncate">
                        {question.question_content || '无题目内容'}
                      </td>
                      {/* 关键修复：先兜底为空数组，再判断长度 */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {((question.tag_names || []).length > 0) ? (
                          <div className="flex flex-wrap gap-1">
                            {(question.tag_names || []).map((tag: string) => (
                              <span key={tag} className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">无标签</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          question.practice_count === 0 
                            ? 'bg-gray-100 text-gray-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {question.practice_count} 次
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDisplayDate(question.create_time)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 表格底部统计 */}
            <div className="px-6 py-4 bg-gray-50 border-t">
              <p className="text-sm text-gray-700">
                共 <span className="font-medium">{filteredQuestions.length}</span> 条错题记录
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}