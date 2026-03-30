'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

interface QuestionStats {
  id: string;
  question_content: string;
  practice_count: number;
  correct_count: number;
  error_count: number;
  accuracy: number;
  tag_names?: string[];
}

interface TagStats {
  tag_name: string;
  question_count: number;
  total_practice: number;
  accuracy: number;
}

export default function Stats() {
  const [qStats, setQStats] = useState<QuestionStats[]>([]);
  const [tStats, setTStats] = useState<TagStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data: questions } = await supabase.from('error_questions').select('id, question_content, tag_names');
      if (!questions) { setLoading(false); return; }

      const stats = await Promise.all(questions.map(async (q) => {
        const { count: total } = await supabase.from('error_question_logs').select('*', { count: 'exact', head: true }).eq('question_id', q.id);
        const { count: ok } = await supabase.from('error_question_logs').select('*', { count: 'exact', head: true }).eq('question_id', q.id).eq('is_correct', true);
        
        const totalCount = total ?? 0;
        const correctCount = ok ?? 0;
        const errorCount = totalCount - correctCount;
        const accuracy = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

        return {
          id: q.id,
          question_content: q.question_content,
          practice_count: totalCount,
          correct_count: correctCount,
          error_count: errorCount,
          accuracy: accuracy,
          tag_names: q.tag_names as string[] | undefined
        };
      }));

      const tagMap: Record<string, { q: number, p: number, c: number }> = {};
      stats.forEach(s => {
        (s.tag_names || []).forEach((t: string) => {
          if (!tagMap[t]) tagMap[t] = { q: 0, p: 0, c: 0 };
          tagMap[t].q += 1;
          tagMap[t].p += s.practice_count;
          tagMap[t].c += s.correct_count;
        });
      });

      const tagStats = Object.entries(tagMap).map(([k, v]) => ({
        tag_name: k,
        question_count: v.q,
        total_practice: v.p,
        accuracy: v.p > 0 ? Math.round(v.c / v.p * 100) : 0
      })).sort((a, b) => b.question_count - a.question_count);

      stats.sort((a, b) => b.practice_count - a.practice_count);
      setQStats(stats);
      setTStats(tagStats);
      setLoading(false);
    };
    fetch();
  }, []);

  const cut = (s: string) => s.length > 20 ? s.slice(0, 20) + '...' : s;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">错题统计仪表盘</h1>
        <div className="mb-8">
          <Link href="/" className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700">返回首页</Link>
        </div>

        {loading ? (
          <div className="bg-white p-8 rounded-lg text-center text-gray-500">加载中...</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-blue-500">
                <h3 className="text-lg text-gray-500 mb-2">总错题数</h3>
                <p className="text-3xl font-bold">{qStats.length}</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-green-500">
                <h3 className="text-lg text-gray-500 mb-2">总练习次数</h3>
                <p className="text-3xl font-bold">{qStats.reduce((sum, cur) => sum + cur.practice_count, 0)}</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-purple-500">
                <h3 className="text-lg text-gray-500 mb-2">平均准确率</h3>
                <p className="text-3xl font-bold">{qStats.length ? Math.round(qStats.reduce((s, c) => s + c.accuracy, 0) / qStats.length) : 0}%</p>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm mb-8 overflow-hidden">
              <div className="p-6 border-b"><h2 className="text-xl font-bold">题目练习统计</h2></div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr><th className="px-6 py-3 text-left text-xs text-gray-500">排名</th><th className="px-6 py-3 text-left text-xs text-gray-500">题目</th><th className="px-6 py-3 text-left text-xs text-gray-500">练习</th><th className="px-6 py-3 text-left text-xs text-gray-500">正确</th><th className="px-6 py-3 text-left text-xs text-gray-500">错误</th><th className="px-6 py-3 text-left text-xs text-gray-500">准确率</th></tr>
                  </thead>
                  <tbody className="divide-y">
                    {qStats.map((st, i) => (
                      <tr key={st.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm">{i + 1}</td>
                        <td className="px-6 py-4 text-sm">{cut(st.question_content)}</td>
                        <td className="px-6 py-4 text-sm">{st.practice_count}</td>
                        <td className="px-6 py-4 text-sm text-green-600">{st.correct_count}</td>
                        <td className="px-6 py-4 text-sm text-red-600">{st.error_count}</td>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex items-center">
                            <div className="w-full bg-gray-200 rounded-full h-2 mr-2"><div className="bg-green-600 h-2 rounded-full" style={{ width: st.accuracy + '%' }}></div></div>
                            <span>{st.accuracy}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="p-6 border-b"><h2 className="text-xl font-bold">标签统计</h2></div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr><th className="px-6 py-3 text-left text-xs text-gray-500">标签</th><th className="px-6 py-3 text-left text-xs text-gray-500">题目数</th><th className="px-6 py-3 text-left text-xs text-gray-500">总练习</th><th className="px-6 py-3 text-left text-xs text-gray-500">准确率</th></tr>
                  </thead>
                  <tbody className="divide-y">
                    {tStats.map((t, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium">{t.tag_name}</td>
                        <td className="px-6 py-4 text-sm">{t.question_count}</td>
                        <td className="px-6 py-4 text-sm">{t.total_practice}</td>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex items-center">
                            <div className="w-full bg-gray-200 rounded-full h-2 mr-2"><div className="bg-purple-600 h-2 rounded-full" style={{ width: t.accuracy + '%' }}></div></div>
                            <span>{t.accuracy}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}