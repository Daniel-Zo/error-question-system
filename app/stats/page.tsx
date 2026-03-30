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
  const [questionStats, setQuestionStats] = useState<QuestionStats[]>([]);
  const [tagStats, setTagStats] = useState<TagStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 获取统计数据
  useEffect(() => {
    const fetchStats = async () => {
      setIsLoading(true);
      try {
        // 1. 获取所有错题
        const { data: questionData } = await supabase
          .from('error_questions')
          .select(`
            id,
            question_content,
            tag_names
          `);
        
        if (!questionData) {
          setIsLoading(false);
          return;
        }
        
        // 2. 统计每道题的练习数据
        const questionStatsData = await Promise.all(
          questionData.map(async (question) => {
            // 总练习次数
            const { count: totalCount } = await supabase
              .from('error_question_logs')
              .select('*', { count: 'exact', head: true })
              .eq('question_id', question.id);
            
            // 正确次数
            const { count: correctCount } = await supabase
              .from('error_question_logs')
              .select('*', { count: 'exact', head: true })
              .eq('question_id', question.id)
              .eq('is_correct', true);
            
            const errorCount = (totalCount || 0) - (correctCount || 0);
            const accuracy = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
            
            return {
              id: question.id,
              question_content: question.question_content,
              practice_count: totalCount || 0,
              correct_count: correctCount || 0,
              error_count: errorCount,
              accuracy: accuracy,
              tag_names: question.tag_names
            };
          })
        );
        
        // 3. 按标签统计
        const tagMap: Record<string, {
          question_count: number;
          total_practice: number;
          correct_count: number;
        }> = {};
        
        // 初始化标签统计
        questionStatsData.forEach(question => {
          (question.tag_names || []).forEach(tag => {
            if (!tagMap[tag]) {
              tagMap[tag] = {
                question_count: 0,
                total_practice: 0,
                correct_count: 0
              };
            }
            
            tagMap[tag].question_count += 1;
            tagMap[tag].total_practice += question.practice_count;
            tagMap[tag].correct_count += question.correct_count;
          });
        });
        
        // 转换为数组并计算准确率
        const tagStatsData = Object.entries(tagMap).map(([tagName, stats]) => ({
          tag_name: tagName,
          question_count: stats.question_count,
          total_practice: stats.total_practice,
          accuracy: stats.total_practice > 0 
            ? Math.round((stats.correct_count / stats.total_practice) * 100) 
            : 0
        })).sort((a, b) => b.question_count - a.question_count);
        
        // 排序：按练习次数降序
        questionStatsData.sort((a, b) => b.practice_count - a.practice_count);
        
        setQuestionStats(questionStatsData);
        setTagStats(tagStatsData);
      } catch (error) {
        console.error('统计失败:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchStats();
  }, []);

  // 截断文本
  const truncate = (text: string, length = 20) => {
    return text.length > length ? text.substring(0, length) + '...' : text;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        {/* 大标题 */}
        <h1 className="text-4xl font-bold text-gray-900 mb-8">错题统计仪表盘</h1>
        
        {/* 返回按钮 */}
        <div className="mb-8">
          <Link
            href="/"
            className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            返回首页
          </Link>
        </div>

        {isLoading ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">
            加载统计数据中...
          </div>
        ) : (
          <>
            {/* 总体统计卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-500">
                <h3 className="text-lg font-medium text-gray-500 mb-2">总错题数</h3>
                <p className="text-3xl font-bold text-gray-900">{questionStats.length}</p>
              </div>
              
              <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-500">
                <h3 className="text-lg font-medium text-gray-500 mb-2">总练习次数</h3>
                <p className="text-3xl font-bold text-gray-900">
                  {questionStats.reduce((sum, q) => sum + q.practice_count, 0)}
                </p>
              </div>
              
              <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-purple-500">
                <h3 className="text-lg font-medium text-gray-500 mb-2">平均准确率</h3>
                <p className="text-3xl font-bold text-gray-900">
                  {questionStats.length > 0 
                    ? `${Math.round(
                        questionStats.reduce((sum, q) => sum + q.accuracy, 0) / questionStats.length
                      )}%` 
                    : '0%'}
                </p>
              </div>
            </div>

            {/* 题目练习统计 */}
            <div className="bg-white rounded-lg shadow-sm mb-8 overflow-hidden">
              <div className="p-6 border-b">
                <h2 className="text-xl font-bold text-gray-900">题目练习统计</h2>
              </div>
              
              {questionStats.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  暂无错题数据
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">排名</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">题目内容</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">练习次数</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">正确次数</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">错误次数</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">准确率</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {questionStats.map((question, index) => (
                        <tr key={question.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm text-gray-900 font-medium">{index + 1}</td>
                          <td className="px-6 py-4 text-sm text-gray-900">{truncate(question.question_content)}</td>
                          <td className="px-6 py-4 text-sm text-gray-900">{question.practice_count}</td>
                          <td className="px-6 py-4 text-sm text-green-600">{question.correct_count}</td>
                          <td className="px-6 py-4 text-sm text-red-600">{question.error_count}</td>
                          <td className="px-6 py-4 text-sm">
                            <div className="flex items-center">
                              <div className="w-full bg-gray-200 rounded-full h-2 mr-2">
                                <div 
                                  className="bg-green-600 h-2 rounded-full" 
                                  style={{ width: `${question.accuracy}%` }}
                                ></div>
                              </div>
                              <span className="text-sm font-medium">{question.accuracy}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 标签统计 */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="p-6 border-b">
                <h2 className="text-xl font-bold text-gray-900">知识点标签统计</h2>
              </div>
              
              {tagStats.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  暂无标签数据
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">标签名称</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">题目数量</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">总练习次数</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">平均准确率</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {tagStats.map((tag, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm text-gray-900 font-medium">{tag.tag_name}</td>
                          <td className="px-6 py-4 text-sm text-gray-900">{tag.question_count}</td>
                          <td className="px-6 py-4 text-sm text-gray-900">{tag.total_practice}</td>
                          <td className="px-6 py-4 text-sm">
                            <div className="flex items-center">
                              <div className="w-full bg-gray-200 rounded-full h-2 mr-2">
                                <div 
                                  className="bg-purple-600 h-2 rounded-full" 
                                  style={{ width: `${tag.accuracy}%` }}
                                ></div>
                              </div>
                              <span className="text-sm font-medium">{tag.accuracy}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}