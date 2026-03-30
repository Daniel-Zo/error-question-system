'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Link from 'next/link';

interface PracticeLog {
  id: string;
  question_id: string;
  practice_time: string;
  is_correct: boolean;
}

interface ErrorQuestion {
  id: string;
  question_content: string;
  tag_names?: string[];
}

// 随机选择n道题目
const getRandomQuestions = (questions: ErrorQuestion[], count = 5) => {
  if (questions.length <= count) return questions;
  
  const shuffled = [...questions].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

export default function DailyPractice() {
  const [allQuestions, setAllQuestions] = useState<ErrorQuestion[]>([]);
  const [practiceQuestions, setPracticeQuestions] = useState<ErrorQuestion[]>([]);
  const [practiceLogs, setPracticeLogs] = useState<PracticeLog[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isPracticing, setIsPracticing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 获取所有错题和练习记录
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // 获取所有错题
        const { data: questionData } = await supabase
          .from('error_questions')
          .select(`
            id,
            question_content,
            tag_names
          `);
        
        // 获取练习记录
        const { data: logData } = await supabase
          .from('error_question_logs')
          .select(`
            id,
            question_id,
            practice_time,
            is_correct
          `)
          .order('practice_time', { ascending: false });
        
        setAllQuestions(questionData || []);
        setPracticeLogs(logData || []);
      } catch (error) {
        console.error('加载失败:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, []);

  // 开始新的练习
  const startPractice = () => {
    if (allQuestions.length === 0) {
      alert('暂无错题，请先添加错题！');
      return;
    }
    
    const randomQuestions = getRandomQuestions(allQuestions, 5);
    setPracticeQuestions(randomQuestions);
    setCurrentQuestionIndex(0);
    setIsPracticing(true);
  };

  // 记录练习结果
  const recordPracticeResult = async (isCorrect: boolean) => {
    const currentQuestion = practiceQuestions[currentQuestionIndex];
    if (!currentQuestion) return;
    
    try {
      // 添加练习记录
      await supabase
        .from('error_question_logs')
        .insert([
          {
            question_id: currentQuestion.id,
            practice_time: new Date().toISOString(),
            is_correct: isCorrect
          }
        ]);
      
      // 更新练习次数
      const { data: countData } = await supabase
        .from('error_question_logs')
        .select('*', { count: 'exact', head: true })
        .eq('question_id', currentQuestion.id);
      
      // 下一题或结束
      if (currentQuestionIndex < practiceQuestions.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
      } else {
        setIsPracticing(false);
        alert('练习完成！');
        // 刷新练习记录
        const { data: logData } = await supabase
          .from('error_question_logs')
          .select('*')
          .order('practice_time', { ascending: false });
        setPracticeLogs(logData || []);
      }
    } catch (error) {
      console.error('记录失败:', error);
      alert('记录练习结果失败，请重试');
    }
  };

  // 截断文本
  const truncate = (text: string, length = 30) => {
    return text.length > length ? text.substring(0, length) + '...' : text;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        {/* 大标题 */}
        <h1 className="text-4xl font-bold text-gray-900 mb-8">每日一练</h1>
        
        {/* 开始练习按钮 */}
        <div className="mb-8">
          <button
            onClick={startPractice}
            disabled={isLoading || isPracticing || allQuestions.length === 0}
            className="px-8 py-3 text-lg font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:bg-gray-400 transition-colors"
          >
            {allQuestions.length === 0 ? '暂无错题可练习' : '开始新的练习'}
          </button>
          <Link
            href="/"
            className="ml-4 px-8 py-3 text-lg font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            返回首页
          </Link>
        </div>

        {/* 练习区域 */}
        {isPracticing && practiceQuestions.length > 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-8 border-l-4 border-green-500">
            <div className="mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                第 {currentQuestionIndex + 1}/{practiceQuestions.length} 题
              </h2>
            </div>
            
            <div className="mb-6">
              <p className="text-lg">{practiceQuestions[currentQuestionIndex].question_content}</p>
              <div className="mt-2 text-sm text-gray-500">
                标签：{(practiceQuestions[currentQuestionIndex].tag_names || []).join('、') || '无标签'}
              </div>
            </div>
            
            <div className="flex gap-4">
              <button
                onClick={() => recordPracticeResult(true)}
                className="flex-1 px-4 py-3 text-lg font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
              >
                回答正确
              </button>
              <button
                onClick={() => recordPracticeResult(false)}
                className="flex-1 px-4 py-3 text-lg font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
              >
                回答错误
              </button>
            </div>
          </div>
        ) : (
          !isLoading && (
            <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">练习历史记录</h2>
              
              {practiceLogs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  暂无练习记录，点击上方按钮开始练习！
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">序号</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">题目</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">练习时间</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">结果</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {practiceLogs.map((log, index) => {
                        const question = allQuestions.find(q => q.id === log.question_id);
                        return (
                          <tr key={log.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 text-sm text-gray-900">{index + 1}</td>
                            <td className="px-6 py-4 text-sm text-gray-900">
                              {question ? truncate(question.question_content) : '题目已删除'}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {new Date(log.practice_time).toLocaleString('zh-CN')}
                            </td>
                            <td className="px-6 py-4 text-sm">
                              <span className={`px-2 py-1 rounded-full text-xs ${
                                log.is_correct 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {log.is_correct ? '正确' : '错误'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        )}
        
        {/* 加载状态 */}
        {isLoading && (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">
            加载中...
          </div>
        )}
      </div>
    </div>
  );
}