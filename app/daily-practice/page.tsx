'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Link from 'next/link';
import Image from 'next/image'; // 引入 Next.js 图片组件

export default function DailyPractice() {
  const [dailyPractices, setDailyPractices] = useState<any[]>([]);
  const [currentPaper, setCurrentPaper] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch historical daily practices
  useEffect(() => {
    const fetchDailyPractices = async () => {
      const { data, error } = await supabase
        .from('daily_practice')
        .select('*')
        .order('generate_time', { ascending: false });

      if (error) console.error('Failed to fetch daily practices:', error);
      else setDailyPractices(data || []);
    };

    fetchDailyPractices();
  }, []);

  // Generate new daily practice (random 10 error questions)
  const generateDailyPractice = async () => {
    setIsLoading(true);
    try {
      // 1. Get all error question IDs
      const { data: questionIds, error } = await supabase
        .from('error_questions')
        .select('id')
        .order('create_time', { ascending: false });

      if (error) throw error;
      if (questionIds.length === 0) {
        alert('No error questions available, cannot generate daily practice!');
        return;
      }

      // 2. Randomly select 10 questions (or all if less than 10)
      const randomQuestionIds = questionIds
        .sort(() => 0.5 - Math.random())
        .slice(0, 10)
        .map(item => item.id);

      // 3. Record daily practice
      const { data: newPaper, error: insertError } = await supabase
        .from('daily_practice')
        .insert({
          included_question_ids: randomQuestionIds,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // 4. Record selection logs for each question
      const logPromises = randomQuestionIds.map(questionId => 
        supabase.from('error_question_logs')
          .insert({
            question_id: questionId,
            selected_scene: 'Daily Practice'
          })
      );
      await Promise.all(logPromises);

      // 5. Get paper details (包含图片URL: question_image_url)
      const { data: paperDetails } = await supabase
        .from('error_questions')
        .select(`
          id,
          question_content,
          knowledge_points,
          correct_answer,
          question_image_url // 新增：查询图片URL字段
        `)
        .in('id', randomQuestionIds);

      setCurrentPaper({
        ...newPaper,
        questionList: paperDetails,
      });

      // Update list
      setDailyPractices([newPaper, ...dailyPractices]);
      alert('Daily practice generated successfully!');
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

      {/* Latest generated paper */}
      {currentPaper && (
        <div className="border p-6 rounded shadow mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            Daily Practice ({new Date(currentPaper.generate_time).toLocaleString()})
          </h2>
          <div className="space-y-8 mt-4"> {/* 增大间距，优化排版 */}
            {currentPaper.questionList.map((question: any, index: number) => (
              <div key={question.id} className="border-b pb-6">
                <h3 className="font-medium text-lg mb-2">
                  {index + 1}. {question.question_content}
                </h3>
                
                {/* 新增：显示错题图片（如果有） */}
                {question.question_image_url && (
                  <div className="my-3 max-w-md">
                    <p className="text-sm text-gray-500 mb-1">Question Image:</p>
                    <div className="border rounded p-1 bg-gray-50">
                      <Image
                        src={question.question_image_url}
                        alt={`Question ${index + 1}`}
                        width={500} // 图片宽度
                        height={300} // 图片高度
                        className="rounded object-contain" // 保持比例，适应容器
                        loading="lazy" // 懒加载优化
                      />
                    </div>
                  </div>
                )}

                <div className="mt-2 text-sm text-gray-600">
                  <span className="font-medium">Knowledge Points:</span> {question.knowledge_points.join(', ')}
                </div>
                
                {question.correct_answer && (
                  <div className="mt-2 text-sm">
                    <span className="text-green-600 font-medium">Correct Answer:</span> {question.correct_answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Historical papers list */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Historical Papers</h2>
        {dailyPractices.length === 0 ? (
          <p>No historical papers</p>
        ) : (
          <div className="space-y-3">
            {dailyPractices.map((paper) => (
              <div key={paper.id} className="border p-4 rounded">
                <div className="flex justify-between items-center">
                  <span>
                    {new Date(paper.generate_time).toLocaleString()}
                  </span>
                  <span className="text-sm bg-gray-100 px-2 py-1 rounded">
                    {paper.included_question_ids.length} Questions
                  </span>
                </div>
              </div>
            ))}
          </div>
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