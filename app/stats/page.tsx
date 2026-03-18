'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Link from 'next/link';

// 定义数据类型
interface QuestionStats {
  id: string;
  question_content: string;
  knowledge_points: string[];
  practice_count: number;
  create_time: string;
}

interface KnowledgePointStats {
  name: string;
  count: number; // 该知识点下的错题数
  practice_count: number; // 该知识点错题的总练习次数
}

export default function StatsDashboard() {
  const [totalQuestions, setTotalQuestions] = useState<number>(0);
  const [questionStats, setQuestionStats] = useState<QuestionStats[]>([]);
  const [knowledgeStats, setKnowledgeStats] = useState<KnowledgePointStats[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [sortBy, setSortBy] = useState<'practice_count' | 'create_time'>('practice_count');

  // 获取统计数据
  useEffect(() => {
    const fetchStats = async () => {
      setIsLoading(true);
      try {
        // 1. 获取总错题数
        const { count: totalCount } = await supabase
          .from('error_questions')
          .select('*', { count: 'exact', head: true });
        setTotalQuestions(totalCount || 0);

        // 2. 获取错题练习次数统计
        const { data: questionData } = await supabase
          .from('error_questions')
          .select(`
            id,
            question_content,
            knowledge_points,
            create_time,
            error_question_logs(count)
          `)
          .order(sortBy === 'practice_count' ? 'error_question_logs.count' : 'create_time', { 
            ascending: false,
            foreignTable: 'error_question_logs'
          });

        // 格式化错题统计数据
        const formattedQuestionStats = (questionData || []).map(item => ({
          id: item.id,
          question_content: item.question_content,
          knowledge_points: item.knowledge_points || [],
          practice_count: item.error_question_logs?.count || 0,
          create_time: item.create_time
        }));
        setQuestionStats(formattedQuestionStats);

        // 3. 统计知识点数据
        const knowledgeMap: Record<string, { count: number; practice_count: number }> = {};
        
        formattedQuestionStats.forEach(question => {
          question.knowledge_points.forEach(tag => {
            if (!knowledgeMap[tag]) {
              knowledgeMap[tag] = { count: 0, practice_count: 0 };
            }
            knowledgeMap[tag].count += 1;
            knowledgeMap[tag].practice_count += question.practice_count;
          });
        });

        // 转换为数组并排序
        const knowledgeStatsArray = Object.entries(knowledgeMap)
          .map(([name, data]) => ({
            name,
            count: data.count,
            practice_count: data.practice_count
          }))
          .sort((a, b) => b.practice_count - a.practice_count);
        
        setKnowledgeStats(knowledgeStatsArray);

      } catch (error) {
        console.error('获取统计数据失败:', error);
        alert('获取统计数据失败，请刷新页面重试');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [sortBy]);

  // 格式化日期
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN');
  };

  // 渲染加载状态
  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">错题统计仪表盘</h1>
          <Link href="/" className="text-blue-600 hover:underline">返回首页</Link>
        </div>
        <div className="flex items-center justify-center h-64">
          <p className="text-xl text-gray-500">数据加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      {/* 页面头部 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
        <h1 className="text-3xl font-bold mb-4 md:mb-0">错题统计仪表盘</h1>
        <div className="flex space-x-4">
          <Link 
            href="/" 
            className="text-blue-600 hover:underline flex items-center"
          >
            ← 返回首页
          </Link>
          <Link 
            href="/add-question" 
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            添加错题
          </Link>
        </div>
      </div>

      {/* 核心数据卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white border rounded-lg shadow-md p-6">
          <h3 className="text-gray-500 text-sm font-medium mb-2">总错题数</h3>
          <p className="text-4xl font-bold text-blue-600">{totalQuestions}</p>
          <p className="text-gray-500 text-sm mt-2">已添加的所有错题数量</p>
        </div>

        <div className="bg-white border rounded-lg shadow-md p-6">
          <h3 className="text-gray-500 text-sm font-medium mb-2">已练习错题数</h3>
          <p className="text-4xl font-bold text-green-600">
            {questionStats.filter(q => q.practice_count > 0).length}
          </p>
          <p className="text-gray-500 text-sm mt-2">被选入每日一练的错题数量</p>
        </div>

        <div className="bg-white border rounded-lg shadow-md p-6">
          <h3 className="text-gray-500 text-sm font-medium mb-2">总练习次数</h3>
          <p className="text-4xl font-bold text-purple-600">
            {questionStats.reduce((sum, q) => sum + q.practice_count, 0)}
          </p>
          <p className="text-gray-500 text-sm mt-2">所有错题被练习的总次数</p>
        </div>
      </div>

      {/* 错题练习次数排行 */}
      <div className="bg-white border rounded-lg shadow-md mb-8 overflow-hidden">
        <div className="p-6 border-b">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">错题练习次数排行</h2>
            <div className="flex space-x-2">
              <button
                onClick={() => setSortBy('practice_count')}
                className={`px-3 py-1 rounded text-sm ${
                  sortBy === 'practice_count' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                按练习次数排序
              </button>
              <button
                onClick={() => setSortBy('create_time')}
                className={`px-3 py-1 rounded text-sm ${
                  sortBy === 'create_time' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                按添加时间排序
              </button>
            </div>
          </div>
        </div>

        {questionStats.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            暂无错题数据
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">序号</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">题目内容</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">知识点</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">练习次数</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">添加时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {questionStats.map((question, index) => (
                  <tr key={question.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{index + 1}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-md truncate">
                      {question.question_content}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {question.knowledge_points.map(tag => (
                        <span key={tag} className="bg-gray-100 px-2 py-1 rounded text-xs mr-1">
                          {tag}
                        </span>
                      ))}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        question.practice_count === 0 
                          ? 'bg-gray-100 text-gray-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {question.practice_count} 次
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(question.create_time)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 知识点统计 */}
      <div className="bg-white border rounded-lg shadow-md mb-8">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">知识点统计</h2>
        </div>

        {knowledgeStats.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            暂无知识点数据
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">序号</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">知识点</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">错题数量</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">总练习次数</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">平均练习次数</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {knowledgeStats.map((knowledge, index) => (
                  <tr key={knowledge.name} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{index + 1}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                      {knowledge.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {knowledge.count} 道
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {knowledge.practice_count} 次
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {(knowledge.practice_count / knowledge.count).toFixed(1)} 次
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}