'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Link from 'next/link';
import { getAllTags } from '../lib/tags';
import format from 'date-fns/format';
import subDays from 'date-fns/subDays';

// 类型定义
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

export default function Home() {
  // 核心数据状态
  const [errorQuestions, setErrorQuestions] = useState<ErrorQuestion[]>([]);
  const [filteredQuestions, setFilteredQuestions] = useState<ErrorQuestion[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 详情/编辑状态
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [selectedQuestion, setSelectedQuestion] = useState<ErrorQuestion | null>(null);
  const [editForm, setEditForm] = useState({
    question_content: '',
    tag_ids: [] as string[],
  });
  const [isEditing, setIsEditing] = useState(false);

  // 查询过滤条件（完整保留）
  const [searchText, setSearchText] = useState('');
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [filterTagIds, setFilterTagIds] = useState<string[]>([]);

  // 刷新数据（复用逻辑）
  const refreshData = async () => {
    setIsLoading(true);
    try {
      // 1. 获取所有标签
      const tagList = await getAllTags();
      setTags(tagList);

      // 2. 获取所有错题（含完整字段）
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

      // 3. 补充练习次数
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
      // 初始化过滤结果
      filterQuestions(questionsWithPracticeCount);
    } catch (error) {
      console.error('数据加载失败:', error);
      alert('数据加载失败，请刷新页面');
    } finally {
      setIsLoading(false);
    }
  };

  // 过滤逻辑（核心保留）
  const filterQuestions = (sourceData: ErrorQuestion[]) => {
    const filtered = sourceData.filter(question => {
      // 1. 关键词过滤
      const matchText = searchText === '' || 
        question.question_content.toLowerCase().includes(searchText.toLowerCase());
      
      // 2. 时间范围过滤
      const questionDate = new Date(question.create_time);
      const start = new Date(`${startDate} 00:00:00`);
      const end = new Date(`${endDate} 23:59:59`);
      const matchDate = questionDate >= start && questionDate <= end;
      
      // 3. 标签过滤
      const matchTag = filterTagIds.length === 0 || 
        filterTagIds.some(tagId => question.tag_ids.includes(tagId));

      return matchText && matchDate && matchTag;
    });
    setFilteredQuestions(filtered);
    // 过滤后重置选中状态
    setSelectedQuestionId(null);
    setSelectedQuestion(null);
  };

  // 初始化加载
  useEffect(() => {
    refreshData();
  }, []);

  // 过滤条件变化时重新过滤
  useEffect(() => {
    if (errorQuestions.length > 0) {
      filterQuestions(errorQuestions);
    }
  }, [searchText, startDate, endDate, filterTagIds]);

  // 辅助函数：截断文本
  const truncateText = (text: string, length = 20) => {
    return text.length <= length ? text : text.substring(0, length) + '...';
  };

  // 打开题目详情
  const openQuestionDetail = (question: ErrorQuestion) => {
    setSelectedQuestionId(question.id);
    setSelectedQuestion(question);
    // 初始化编辑表单
    setEditForm({
      question_content: question.question_content,
      tag_ids: [...question.tag_ids],
    });
    setIsEditing(false);
  };

  // 保存修改
  const saveQuestionEdit = async () => {
    if (!selectedQuestion) return;
    try {
      await supabase
        .from('error_questions')
        .update({
          question_content: editForm.question_content,
          tag_ids: editForm.tag_ids,
        })
        .eq('id', selectedQuestion.id);
      // 刷新数据 + 退出编辑
      await refreshData();
      setIsEditing(false);
      alert('修改成功！');
    } catch (error) {
      console.error('修改失败:', error);
      alert('修改失败，请重试');
    }
  };

  // 删除题目
  const deleteQuestion = async () => {
    if (!selectedQuestion) return;
    if (!confirm('确定要删除这道错题吗？删除后不可恢复！')) return;
    try {
      await supabase.from('error_questions').delete().eq('id', selectedQuestion.id);
      // 刷新数据 + 关闭详情
      await refreshData();
      setSelectedQuestionId(null);
      setSelectedQuestion(null);
      alert('删除成功！');
    } catch (error) {
      console.error('删除失败:', error);
      alert('删除失败，请重试');
    }
  };

  // 重置过滤条件
  const resetFilter = () => {
    setSearchText('');
    setStartDate(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
    setEndDate(format(new Date(), 'yyyy-MM-dd'));
    setFilterTagIds([]);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto">
        {/* 页面头部（保留查询过滤 + 按钮间距） */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800 mb-4 md:mb-0">错题管理系统</h1>
            <div className="flex flex-wrap gap-6">
              <Link 
                href="/add-question" 
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg transition-all"
              >
                添加错题
              </Link>
              <Link 
                href="/daily-practice" 
                className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg transition-all"
              >
                每日一练
              </Link>
              <Link 
                href="/stats" 
                className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2 rounded-lg transition-all"
              >
                错题统计
              </Link>
            </div>
          </div>

          {/* 查询过滤区域（完整保留） */}
          <div className="bg-gray-50 rounded-lg p-4 border">
            <h2 className="text-lg font-medium text-gray-700 mb-4">错题查询</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 关键词搜索 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">题目内容</label>
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="输入题目关键词..."
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

              {/* 重置按钮 */}
              <div className="flex items-end gap-2">
                <button
                  onClick={resetFilter}
                  className="flex-1 px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-all"
                >
                  重置
                </button>
              </div>
            </div>

            {/* 标签过滤 */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">知识点标签</label>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => {
                      setFilterTagIds(prev => 
                        prev.includes(tag.id)
                          ? prev.filter(id => id !== tag.id)
                          : [...prev, tag.id]
                      );
                    }}
                    className={`px-3 py-1 rounded-full text-sm transition-all ${
                      filterTagIds.includes(tag.id)
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
      </div>

      {/* 错题表格（保留+优化） */}
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">序号</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">题目ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">题目内容</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">知识点标签</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">练习次数</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">添加时间</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredQuestions.map((question, index) => (
                  <tr key={question.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{index + 1}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                      {question.id.substring(0, 8)}...
                    </td>
                    <td className="px-6 py-4 text-sm max-w-xl">
                      <button
                        onClick={() => openQuestionDetail(question)}
                        className="text-blue-600 hover:text-blue-800 hover:underline truncate block"
                      >
                        {truncateText(question.question_content, 20)}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {((question.tag_names || []).length > 0) ? (
                        <div className="flex flex-wrap gap-1">
                          {(question.tag_names || []).map((tag) => (
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
                      {new Date(question.create_time).toLocaleString('zh-CN')}
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

      {/* 题目详情/编辑区域（表格下方） */}
      {selectedQuestion && (
        <div className="mt-6 bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-xl font-bold text-gray-800">
              题目详情 {isEditing && '(编辑中)'}
            </h2>
            <div className="flex gap-3">
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-blue-600 hover:text-blue-800 transition-colors"
                >
                  编辑
                </button>
              )}
              {isEditing && (
                <button
                  onClick={() => setIsEditing(false)}
                  className="text-gray-600 hover:text-gray-800 transition-colors"
                >
                  取消
                </button>
              )}
              <button
                onClick={deleteQuestion}
                className="text-red-600 hover:text-red-800 transition-colors"
              >
                删除
              </button>
              <button
                onClick={() => {
                  setSelectedQuestionId(null);
                  setSelectedQuestion(null);
                }}
                className="text-gray-600 hover:text-gray-800 transition-colors"
              >
                关闭
              </button>
            </div>
          </div>

          {/* 查看模式 */}
          {!isEditing ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">完整题目内容</h3>
                  <p className="text-gray-800">{selectedQuestion.question_content || '无题目内容'}</p>
                </div>
                {selectedQuestion.error_reason && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">错误原因</h3>
                    <p className="text-gray-800">{selectedQuestion.error_reason}</p>
                  </div>
                )}
                {selectedQuestion.correct_answer && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">正确答案</h3>
                    <p className="text-gray-800">{selectedQuestion.correct_answer}</p>
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">知识点标签</h3>
                  {((selectedQuestion.tag_names || []).length > 0) ? (
                    <div className="flex flex-wrap gap-1">
                      {(selectedQuestion.tag_names || []).map((tag) => (
                        <span key={tag} className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-gray-400 text-xs">无标签</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">练习次数</h3>
                    <p className="text-gray-800">{selectedQuestion.practice_count} 次</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">添加时间</h3>
                    <p className="text-gray-800">{new Date(selectedQuestion.create_time).toLocaleString('zh-CN')}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                {selectedQuestion.question_image_url && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">题目图片</h3>
                    <img
                      src={selectedQuestion.question_image_url}
                      alt="题目图片"
                      className="w-full max-w-md mx-auto rounded-lg border shadow-sm object-contain"
                      style={{ maxHeight: '300px' }}
                    />
                  </div>
                )}
                {selectedQuestion.correct_answer_image_url && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">答案图片</h3>
                    <img
                      src={selectedQuestion.correct_answer_image_url}
                      alt="答案图片"
                      className="w-full max-w-md mx-auto rounded-lg border shadow-sm object-contain"
                      style={{ maxHeight: '300px' }}
                    />
                  </div>
                )}
                {!selectedQuestion.question_image_url && !selectedQuestion.correct_answer_image_url && (
                  <p className="text-gray-400 text-center py-4">暂无相关图片</p>
                )}
              </div>
            </div>
          ) : (
            // 编辑模式
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  题目内容 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={editForm.question_content}
                  onChange={(e) => setEditForm({ ...editForm, question_content: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={4}
                  placeholder="请输入题目内容..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">知识点标签</label>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => {
                        setEditForm({
                          ...editForm,
                          tag_ids: editForm.tag_ids.includes(tag.id)
                            ? editForm.tag_ids.filter(id => id !== tag.id)
                            : [...editForm.tag_ids, tag.id]
                        });
                      }}
                      className={`px-3 py-1 rounded-full text-sm transition-all ${
                        editForm.tag_ids.includes(tag.id)
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                      }`}
                    >
                      {tag.name}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={saveQuestionEdit}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-all"
              >
                保存修改
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}