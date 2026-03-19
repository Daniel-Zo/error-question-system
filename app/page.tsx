'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Link from 'next/link';
import { getAllTags } from '../lib/tags';
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

  const [searchText, setSearchText] = useState('');
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [filterTagIds, setFilterTagIds] = useState<string[]>([]);

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

  const truncate = (s: string, n = 20) => s.length > n ? s.slice(0, n) + '...' : s;

  const openDetail = (q: ErrorQuestion) => {
    setSelectedQuestion(q);
    setEditForm({
      question_content: q.question_content,
      tag_ids: [...q.tag_ids],
    });
    setIsEditing(false);
  };

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

  const handleDelete = async () => {
    if (!selectedQuestion) return;
    if (!confirm('确定删除该题目？')) return;
    await supabase.from('error_questions').delete().eq('id', selectedQuestion.id);
    setSelectedQuestion(null);
    await refreshData();
  };

  const resetFilter = () => {
    setSearchText('');
    setStartDate(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
    setEndDate(format(new Date(), 'yyyy-MM-dd'));
    setFilterTagIds([]);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto">
        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
            <h1 className="text-2xl font-bold">错题管理系统</h1>
            <div className="flex gap-6 mt-3 md:mt-0">
              <Link href="/add-question" className="bg-blue-600 text-white px-5 py-2 rounded">添加错题</Link>
              <Link href="/daily-practice" className="bg-green-600 text-white px-5 py-2 rounded">每日一练</Link>
              <Link href="/stats" className="bg-purple-600 text-white px-5 py-2 rounded">统计</Link>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded border">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm block mb-1">题目内容</label>
                <input
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="w-full border p-2 rounded"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-sm block mb-1">开始日期</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full border p-2 rounded"
                  />
                </div>
                <div>
                  <label className="text-sm block mb-1">结束日期</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full border p-2 rounded"
                  />
                </div>
              </div>
              <div className="flex items-end">
                <button onClick={resetFilter} className="w-full bg-gray-200 p-2 rounded">重置</button>
              </div>
            </div>

            <div className="mt-3">
              <label className="text-sm block mb-2">标签筛选</label>
              <div className="flex flex-wrap gap-2">
                {tags.map(tag => (
                  <button
                    key={tag.id}
                    onClick={() => {
                      setFilterTagIds(prev =>
                        prev.includes(tag.id) ? prev.filter(x => x !== tag.id) : [...prev, tag.id]
                      );
                    }}
                    className={`px-2 py-1 rounded-full text-xs ${
                      filterTagIds.includes(tag.id) ? 'bg-blue-600 text-white' : 'bg-gray-100'
                    }`}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="bg-white p-8 rounded-xl shadow text-center">加载中...</div>
        ) : filteredQuestions.length === 0 ? (
          <div className="bg-white p-8 rounded-xl shadow text-center">暂无数据</div>
        ) : (
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs text-gray-500">序号</th>
                    <th className="px-4 py-2 text-left text-xs text-gray-500">ID</th>
                    <th className="px-4 py-2 text-left text-xs text-gray-500">题目内容</th>
                    <th className="px-4 py-2 text-left text-xs text-gray-500">标签</th>
                    <th className="px-4 py-2 text-left text-xs text-gray-500">练习次数</th>
                    <th className="px-4 py-2 text-left text-xs text-gray-500">时间</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredQuestions.map((q, i) => (
                    <tr key={q.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">{i + 1}</td>
                      <td className="px-4 py-3 text-sm font-mono">{q.id.slice(0, 6)}...</td>
                      <td className="px-4 py-3 text-sm max-w-xs">
                        <button onClick={() => openDetail(q)} className="text-blue-600 hover:underline text-left">
                          {truncate(q.question_content)}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {(q.tag_names || []).join('、') || '无标签'}
                      </td>
                      <td className="px-4 py-3 text-sm">{q.practice_count}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(q.create_time).toLocaleString('zh-CN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {selectedQuestion && (
          <div className="mt-6 bg-white p-6 rounded-xl shadow border-l-4 border-blue-500">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">题目详情 {isEditing && '(编辑中)'}</h2>
              <div className="flex gap-3">
                {!isEditing && <button onClick={() => setIsEditing(true)} className="text-blue-600">编辑</button>}
                {isEditing && <button onClick={() => setIsEditing(false)} className="text-gray-600">取消</button>}
                <button onClick={handleDelete} className="text-red-600">删除</button>
                <button onClick={() => setSelectedQuestion(null)}>关闭</button>
              </div>
            </div>

            {!isEditing ? (
              <div>
                <p className="mb-2"><strong>题目：</strong>{selectedQuestion.question_content}</p>
                <p className="mb-2"><strong>标签：</strong>{(selectedQuestion.tag_names || []).join('、') || '无标签'}</p>

                {selectedQuestion.question_image_url && (
                  <div className="my-3">
                    <img
                      src={selectedQuestion.question_image_url}
                      alt="题目图片"
                      className="rounded-lg border object-contain"
                      style={{ maxHeight: '240px', maxWidth: '100%' }}
                    />
                  </div>
                )}
                {selectedQuestion.correct_answer_image_url && (
                  <div className="my-3">
                    <img
                      src={selectedQuestion.correct_answer_image_url}
                      alt="答案图片"
                      className="rounded-lg border object-contain"
                      style={{ maxHeight: '240px', maxWidth: '100%' }}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm mb-1">题目内容</label>
                  <textarea
                    className="w-full border p-2 rounded"
                    rows={3}
                    value={editForm.question_content}
                    onChange={(e) => setEditForm({ ...editForm, question_content: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm mb-2">知识点标签（可多选）</label>
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
                        className={`px-3 py-1 rounded-full text-xs ${
                          editForm.tag_ids.includes(tag.id) ? 'bg-blue-600 text-white' : 'bg-gray-100'
                        }`}
                      >
                        {tag.name}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleUpdate}
                  className="bg-blue-600 text-white px-4 py-2 rounded"
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