'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Link from 'next/link';
import Image from 'next/image';

export default function DailyPractice() {
  const [dailyPractices, setDailyPractices] = useState<any[]>([]);
  const [currentPaper, setCurrentPaper] = useState<any>(null);
  const [selectedHistoryPaper, setSelectedHistoryPaper] = useState<any>(null); // 选中的历史记录
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false); // 加载历史详情的状态

  // 获取历史练习记录
  useEffect(() => {
    const fetchDailyPractices = async () => {
      const { data, error } = await supabase
        .from('daily_practice')
        .select('*')
        .order('generate_time', { ascending: false });

      if (error) console.error('获取历史练习记录失败:', error);
      else setDailyPractices(data || []);
    };

    fetchDailyPractices();
  }, []);

  // 生成新的每日一练
  const generateDailyPractice = async () => {
    setIsLoading(true);
    try {
      const { data: questionIds, error } = await supabase
        .from('error_questions')
        .select('id')
        .order('create_time', { ascending: false });

      if (error) throw error;
      const validQuestionIds = questionIds || [];
      if (validQuestionIds.length === 0) {
        alert('暂无错题，无法生成每日一练！');
        return;
      }

      // 随机选择10道题（不足10道则全部选择）
      const randomQuestionIds = validQuestionIds
        .sort(() => 0.5 - Math.random())
        .slice(0, 10)
        .map(item => item.id);

      // 保存每日一练记录
      const { data: newPaper, error: insertError } = await supabase
        .from('daily_practice')
        .insert({
          included_question_ids: randomQuestionIds,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // 记录每道题的选中日志
      const logPromises = randomQuestionIds.map(questionId => 
        supabase.from('error_question_logs')
          .insert({
            question_id: questionId,
            selected_scene: 'Daily Practice'
          })
      );
      await Promise.all(logPromises);

      // 获取练习题详情
      const { data: paperDetails } = await supabase
        .from('error_questions')
        .select(`
          id,
          question_content,
          knowledge_points,
          correct_answer,
          question_image_url
        `)
        .in('id', randomQuestionIds);

      // 设置当前练习题
      setCurrentPaper({
        ...newPaper,
        questionList: paperDetails || [],
      });

      // 更新历史记录列表
      setDailyPractices(prev => [newPaper, ...(prev || [])]);
      alert('每日一练生成成功！');
    } catch (error) {
      alert(`生成失败：${(error as Error).message}`);
      console.error('生成每日一练错误:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 查看历史记录详情
  const viewHistoryPaper = async (paper: any) => {
    setIsLoadingHistory(true);
    try {
      // 根据历史记录中的题目ID查询详情
      const { data: paperDetails } = await supabase
        .from('error_questions')
        .select(`
          id,
          question_content,
          knowledge_points,
          correct_answer,
          question_image_url
        `)
        .in('id', paper.included_question_ids || []);

      // 设置选中的历史记录（包含题目详情）
      setSelectedHistoryPaper({
        ...paper,
        questionList: paperDetails || [],
      });
    } catch (error) {
      alert(`加载历史记录失败：${(error as Error).message}`);
      console.error('加载历史记录错误:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // 关闭历史记录详情
  const closeHistoryPaper = () => {
    setSelectedHistoryPaper(null);
  };

  // 渲染题目列表（复用逻辑）
  const renderQuestionList = (questionList: any[]) => {
    if (!questionList || questionList.length === 0) {
      return <p className="text-gray-500">暂无题目</p>;
    }

    return (
      <div className="space-y-8 mt-4">
        {questionList.map((question: any, index: number) => {
          const knowledgePoints = question.knowledge_points || [];
          const questionContent = question.question_content || '无题目内容';
          
          return (
            <div key={question.id || `question-${index}`} className="border-b pb-6">
              <h3 className="font-medium text-lg mb-2">
                {index + 1}. {questionContent}
              </h3>
              
              {/* 题目图片 */}
              {question.question_image_url && (
                <div className="my-3 max-w-md">
                  <p className="text-sm text-gray-500 mb-1">题目图片：</p>
                  <div className="border rounded p-1 bg-gray-50">
                    <Image
                      src={question.question_image_url}
                      alt={`题目 ${index + 1}`}
                      width={500}
                      height={300}
                      className="rounded object-contain"
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                </div>
              )}

              <div className="mt-2 text-sm text-gray-600">
                <span className="font-medium">知识点：</span> {knowledgePoints.join('， ')}
              </div>
              
              {question.correct_answer && (
                <div className="mt-2 text-sm">
                  <span className="text-green-600 font-medium">正确答案：</span> {question.correct_answer}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">每日一练</h1>
        <button
          onClick={generateDailyPractice}
          disabled={isLoading}
          className="bg-green-500 text-white px-4 py-2 rounded disabled:bg-gray-400"
        >
          {isLoading ? '生成中...' : '生成新练习题'}
        </button>
      </div>

      {/* 最新生成的练习题 */}
      {currentPaper && currentPaper.questionList && currentPaper.questionList.length > 0 ? (
        <div className="border p-6 rounded shadow mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            最新练习题（{new Date(currentPaper.generate_time).toLocaleString()}）
          </h2>
          {renderQuestionList(currentPaper.questionList)}
        </div>
      ) : currentPaper ? (
        <div className="border p-6 rounded shadow mb-8">
          <h2 className="text-2xl font-semibold mb-4">每日一练</h2>
          <p className="text-gray-500">本套练习题暂无题目</p>
        </div>
      ) : null}

      {/* 历史记录详情弹窗/区域 */}
      {selectedHistoryPaper && (
        <div className="border p-6 rounded shadow mb-8 bg-white z-10 relative">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold">
              历史练习题详情（{new Date(selectedHistoryPaper.generate_time).toLocaleString()}）
            </h2>
            <button
              onClick={closeHistoryPaper}
              className="bg-gray-200 text-gray-800 px-2 py-1 rounded"
            >
              关闭
            </button>
          </div>
          {isLoadingHistory ? (
            <p>加载中...</p>
          ) : (
            renderQuestionList(selectedHistoryPaper.questionList)
          )}
        </div>
      )}

      {/* 历史练习记录列表 */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">历史练习记录</h2>
        {dailyPractices && dailyPractices.length > 0 ? (
          <div className="space-y-3">
            {dailyPractices.map((paper) => (
              <div 
                key={paper.id || `paper-${Date.now()}`} 
                className="border p-4 rounded cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => viewHistoryPaper(paper)}
              >
                <div className="flex justify-between items-center">
                  <span>
                    {new Date(paper.generate_time).toLocaleString()}
                  </span>
                  <span className="text-sm bg-gray-100 px-2 py-1 rounded">
                    {(paper.included_question_ids || []).length} 道题目
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">点击查看详情</p>
              </div>
            ))}
          </div>
        ) : (
          <p>暂无历史练习记录</p>
        )}
      </div>

      <div className="mt-8">
        <Link href="/" className="text-blue-500 hover:underline">
          ← 返回首页
        </Link>
      </div>
    </div>
  );
}