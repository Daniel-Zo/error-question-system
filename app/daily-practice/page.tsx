'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Link from 'next/link';
import Image from 'next/image';

export default function DailyPractice() {
  // 初始化时给默认值，避免 null
  const [dailyPractices, setDailyPractices] = useState<any[]>([]);
  // 初始化为 null，但渲染时做严格校验
  const [currentPaper, setCurrentPaper] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchDailyPractices = async () => {
      const { data, error } = await supabase
        .from('daily_practice')
        .select('*')
        .order('generate_time', { ascending: false });

      if (error) console.error('Failed to fetch daily practices:', error);
      // 确保 data 非空，否则赋值为空数组
      else setDailyPractices(data || []);
    };

    fetchDailyPractices();
  }, []);

  const generateDailyPractice = async () => {
    setIsLoading(true);
    try {
      const { data: questionIds, error } = await supabase
        .from('error_questions')
        .select('id')
        .order('create_time', { ascending: false });

      if (error) throw error;
      // 空值校验：确保 questionIds 是数组
      const validQuestionIds = questionIds || [];
      if (validQuestionIds.length === 0) {
        alert('No error questions available, cannot generate daily practice!');
        return;
      }

      const randomQuestionIds = validQuestionIds
        .sort(() => 0.5 - Math.random())
        .slice(0, 10)
        .map(item => item.id);

      const { data: newPaper, error: insertError } = await supabase
        .from('daily_practice')
        .insert({
          included_question_ids: randomQuestionIds,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const logPromises = randomQuestionIds.map(questionId => 
        supabase.from('error_question_logs')
          .insert({
            question_id: questionId,
            selected_scene: 'Daily Practice'
          })
      );
      await Promise.all(logPromises);

      // 查询错题详情时，确保返回空数组而非 null
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

      // 关键：确保 paperDetails 是数组（即使无数据）
      setCurrentPaper({
        ...newPaper,
        questionList: paperDetails || [], // 空值兜底：null → 空数组
      });

      alert('Daily practice generated successfully!');
      // 更新历史列表时也做空值校验
      setDailyPractices(prev => [newPaper, ...(prev || [])]);
    } catch (error) {
      alert('Generation failed: ' + (error as Error).message);
      console.error('Generate daily practice error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Daily Practice</h1>
        <button
          onClick={generateDailyPractice}
          disabled={isLoading}
          className="bg-green-500 text-white px-4 py-2 rounded disabled:bg-gray-400"
        >
          {isLoading ? 'Generating...' : 'Generate New Paper'}
        </button>
      </div>

      {/* 关键：先校验 currentPaper 和 questionList 都非空，再遍历 */}
      {currentPaper && currentPaper.questionList && currentPaper.questionList.length > 0 ? (
        <div className="border p-6 rounded shadow mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            Daily Practice ({new Date(currentPaper.generate_time).toLocaleString()})
          </h2>
          <div className="space-y-8 mt-4">
            {currentPaper.questionList.map((question: any, index: number) => {
              // 对每个题目的字段做空值兜底
              const knowledgePoints = question.knowledge_points || [];
              const questionContent = question.question_content || 'No question content';
              
              return (
                <div key={question.id || `question-${index}`} className="border-b pb-6">
                  <h3 className="font-medium text-lg mb-2">
                    {index + 1}. {questionContent}
                  </h3>
                  
                  {/* 图片显示：校验 question_image_url 非空 */}
                  {question.question_image_url && (
                    <div className="my-3 max-w-md">
                      <p className="text-sm text-gray-500 mb-1">Question Image:</p>
                      <div className="border rounded p-1 bg-gray-50">
                        <Image
                          src={question.question_image_url}
                          alt={`Question ${index + 1}`}
                          width={500}
                          height={300}
                          className="rounded object-contain"
                          loading="lazy"
                          // 图片加载失败时的兜底
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="mt-2 text-sm text-gray-600">
                    <span className="font-medium">Knowledge Points:</span> {knowledgePoints.join(', ')}
                  </div>
                  
                  {question.correct_answer && (
                    <div className="mt-2 text-sm">
                      <span className="text-green-600 font-medium">Correct Answer:</span> {question.correct_answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : currentPaper ? (
        // 有 currentPaper 但无题目时的提示
        <div className="border p-6 rounded shadow mb-8">
          <h2 className="text-2xl font-semibold mb-4">Daily Practice</h2>
          <p className="text-gray-500">No questions found in this practice paper.</p>
        </div>
      ) : null}

      {/* 历史列表：校验 dailyPractices 非空 */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Historical Papers</h2>
        {dailyPractices && dailyPractices.length > 0 ? (
          <div className="space-y-3">
            {dailyPractices.map((paper) => (
              <div key={paper.id || `paper-${Date.now()}`} className="border p-4 rounded">
                <div className="flex justify-between items-center">
                  <span>
                    {new Date(paper.generate_time).toLocaleString()}
                  </span>
                  <span className="text-sm bg-gray-100 px-2 py-1 rounded">
                    {(paper.included_question_ids || []).length} Questions
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p>No historical papers</p>
        )}
      </div>

      <div className="mt-8">
        <Link href="/" className="text-blue-500 hover:underline">
          ← Back to Home
        </Link>
      </div>
    </div>
  );
}