'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { getAllTags } from '@/lib/tags';
import format from 'date-fns/format';
import subDays from 'date-fns/subDays';

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
  practice_count: number;
  error_reason?: string;
  correct_answer?: string;
  question_image_url?: string;
  correct_answer_image_url?: string;
}

// 提取图片删除工具函数
const deleteImageFromStorage = async (imageUrl?: string) => {
  if (!imageUrl) return;
  try {
    // 解析Supabase存储路径
    const urlParts = new URL(imageUrl);
    const path = decodeURIComponent(urlParts.pathname.split('/').slice(3).join('/'));
    await supabase.storage.from('error_question_images').remove([path]);
  } catch (error) {
    console.error('删除图片失败:', error);
  }
};

export default function Home() {
  const [errorQuestions, setErrorQuestions] = useState<ErrorQuestion[]>([]);
  const [filteredQuestions, setFilteredQuestions] = useState<ErrorQuestion[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedQuestion, setSelectedQuestion] = useState<ErrorQuestion | null>(null);
  const [editForm, setEditForm] = useState({
    question_content: '',
    tag_ids: [] as string[],
  });
  const [isEditing, setIsEditing] = useState(false);

  // 查询条件
  const [searchText, setSearchText] = useState('');
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [filterTagIds, setFilterTagIds] = useState<string[]>([]);

  // 刷新数据
  const refreshData = async () => {
    setIsLoading(true);
    try {
      const tagList = await getAllTags();
      setTags(tagList);

      const { data: questionData } = await supabase
        .from('error_questions')
        .select(`
          id,
          question_content,
          tag_ids,
          create_time,
          error_reason,
          correct_answer,
          question_image_url,
          correct_answer_image_url
        `)
        .order('create_time', { ascending: false });

      const questionsWithPracticeCount = await Promise.all(
        (questionData || []).map(async (item) => {
          const { count: practiceCount } = await supabase
            .from('error_question_logs')
            .select('*', { count: 'exact', head: true })
            .eq('question_id', item.id);
          return {
            id: item.id,
            question_content: item.question_content || '',
            tag_ids: item.tag_ids || [],
            tag_names: item.tag_ids.map((tagId: string) =>
              tagList.find(tag => tag.id === tagId)?.name || ''
            ).filter(Boolean),
            create_time: item.create_time,
            practice_count: practiceCount || 0,
            error_reason: item.error_reason,
            correct_answer: item.correct_answer,
            question_image_url: item.question_image_url,
            correct_answer_image_url: item.correct_answer_image_url
          };
        })
      );

      setErrorQuestions(questionsWithPracticeCount);
      filterQuestions(questionsWithPracticeCount);
    } catch (error) {
      console.error('加载失败', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 过滤
  const filterQuestions = (source: ErrorQuestion[]) => {
    const filtered = source.filter(q => {
      const matchText = !searchText || q.question_content.toLowerCase().includes(searchText.toLowerCase());
      const qDate = new Date(q.create_time);
      const s = new Date(startDate);
      const e = new Date(endDate + ' 23:59:59');
      const matchDate = qDate >= s && qDate <= e;
      const matchTag = filterTagIds.length === 0 || filterTagIds.some(t => q.tag_ids.includes(t));
      return matchText && matchDate && matchTag;
    });
    setFilteredQuestions(filtered);
    setSelectedQuestion(null);
  };

  useEffect(() => {
    refreshData();
  }, []);

  useEffect(() => {
    if (errorQuestions.length > 0) filterQuestions(errorQuestions);
  }, [searchText, startDate, endDate, filterTagIds]);

  // 截断20字
  const truncate = (s: string, n = 20) => s.length > n ? s.slice(0, n) + '...' : s;

  // 打开详情
  const openDetail = (q: ErrorQuestion) => {
    setSelectedQuestion(q);
    setEditForm({
      question_content: q.question_content,
      tag_ids: [...q.tag_ids],
    });
    setIsEditing(false);
  };

  // 保存修改
  const handleUpdate = async () => {
    if (!selectedQuestion) return;
    await supabase
      .from('error_questions')
      .update({
        question_content: editForm.question_content,
        tag_ids: editForm.tag_ids,
      })
      .eq('id', selectedQuestion.id);
    await refreshData();
    setIsEditing(false);
  };

  // 删除（包含图片删除）
  const handleDelete = async () => {
    if (!selectedQuestion) return;
    if (!confirm('确定删除该题目？删除后不可恢复！')) return;
    
    try {
      // 1. 删除关联图片
      await deleteImageFromStorage(selectedQuestion.question_image_url);
      await deleteImageFromStorage(selectedQuestion.correct_answer_image_url);
      
      // 2. 删除错题记录
      await supabase.from('error_questions').delete().eq('id', selectedQuestion.id);
      
      // 3. 删除练习记录
      await supabase.from('error_question_logs').delete().eq('question_id', selectedQuestion.id);
      
      // 4. 刷新数据
      setSelectedQuestion(null);
      await refreshData();
      alert('删除成功！');
    } catch (error) {
      console.error('删除失败:', error);
      alert('删除失败，请重试！');
    }
  };

  // 重置筛选
  const resetFilter = () => {
    setSearchText('');
    setStartDate(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
    setEndDate(format(new Date(), 'yyyy-MM-dd'));
    setFilterTagIds([]);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        {/* 大标题 */}
        <h1 className="text-4xl font-bold text-gray-900 mb-8">错题管理系统</h1>

        {/* 核心查询区 */}
        <div className="flex items-center gap-4 mb-8 max-w-3xl">
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="输入题目关键词查询"
            className="flex-1 px-4 py-3 text-lg border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => filterQuestions(errorQuestions)}
            className="px-8 py-3 text-lg font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
          >
            查询
          </button>
        </div>

        {/* 高级筛选区 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8 max-w-5xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">开始日期</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">结束日期</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={resetFilter}
                className="w-full px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                重置筛选
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">知识点标签</label>
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => {
                    setFilterTagIds(prev =>
                      prev.includes(tag.id) ? prev.filter(x => x !== tag.id) : [...prev, tag.id]
                    );
                  }}
                  className={`px-3 py-1 rounded-full text-sm ${
                    filterTagIds.includes(tag.id) ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 导航按钮 */}
        <div className="flex gap-4 mb-8">
          <Link
            href="/add-question"
            className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            添加错题
          </Link>
          <Link
            href="/daily-practice"
            className="px-4 py-2 text-white bg-green-600 rounded-md hover:bg-green-700"
          >
            每日一练
          </Link>
          <Link
            href="/stats"
            className="px-4 py-2 text-white bg-purple-600 rounded-md hover:bg-purple-700"
          >
            错题统计
          </Link>
        </div>

        {/* 结果列表区 */}
        {isLoading ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">
            加载中...
          </div>
        ) : filteredQuestions.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">
            暂无符合条件的记录
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">序号</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">题目ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">题目内容</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">标签</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">练习次数</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">添加时间</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredQuestions.map((q, i) => (
                    <tr key={q.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">{i + 1}</td>
                      <td className="px-6 py-4 text-sm text-gray-900 font-mono">{q.id.slice(0, 8)}...</td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                        <button
                          onClick={() => openDetail(q)}
                          className="text-blue-600 hover:underline text-left"
                        >
                          {truncate(q.question_content)}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {(q.tag_names || []).join('、') || '无标签'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">{q.practice_count} 次</td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(q.create_time).toLocaleString('zh-CN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 详情/编辑区 */}
        {selectedQuestion && (
          <div className="mt-8 bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-500">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">题目详情</h2>
              <div className="flex gap-3">
                {!isEditing && (
                  <button onClick={() => setIsEditing(true)} className="text-blue-600">编辑</button>
                )}
                {isEditing && (
                  <button onClick={() => setIsEditing(false)} className="text-gray-600">取消</button>
                )}
                <button onClick={handleDelete} className="text-red-600">删除</button>
                <button onClick={() => setSelectedQuestion(null)} className="text-gray-600">关闭</button>
              </div>
            </div>

            {!isEditing ? (
              <div>
                <p className="mb-3 text-lg"><strong>题目：</strong>{selectedQuestion.question_content}</p>
                <p className="mb-3"><strong>标签：</strong>{(selectedQuestion.tag_names || []).join('、') || '无标签'}</p>
                {selectedQuestion.error_reason && (
                  <p className="mb-3"><strong>错误原因：</strong>{selectedQuestion.error_reason}</p>
                )}
                {selectedQuestion.correct_answer && (
                  <p className="mb-3"><strong>正确答案：</strong>{selectedQuestion.correct_answer}</p>
                )}
                {selectedQuestion.question_image_url && (
                  <div className="my-4">
                    <img
                      src={selectedQuestion.question_image_url}
                      alt="题目图片"
                      className="max-h-[240px] max-w-full object-contain rounded-md border"
                    />
                  </div>
                )}
                {selectedQuestion.correct_answer_image_url && (
                  <div className="my-4">
                    <img
                      src={selectedQuestion.correct_answer_image_url}
                      alt="答案图片"
                      className="max-h-[240px] max-w-full object-contain rounded-md border"
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">题目内容</label>
                  <textarea
                    value={editForm.question_content}
                    onChange={(e) => setEditForm({ ...editForm, question_content: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">知识点标签</label>
                  <div className="flex flex-wrap gap-2">
                    {tags.map(tag => (
                      <button
                        key={tag.id}
                        onClick={() => {
                          const next = editForm.tag_ids.includes(tag.id)
                            ? editForm.tag_ids.filter(x => x !== tag.id)
                            : [...editForm.tag_ids, tag.id];
                          setEditForm({ ...editForm, tag_ids: next });
                        }}
                        className={`px-3 py-1 rounded-full text-sm ${
                          editForm.tag_ids.includes(tag.id) ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {tag.name}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={handleUpdate}
                  className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  保存修改
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}