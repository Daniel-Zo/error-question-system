'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Link from 'next/link';

export default function DailyPractice() {
  const [dailyPractices, setDailyPractices] = useState<any[]>([]);
  const [currentPaper, setCurrentPaper] = useState<any>(null);
  const [selectedHistoryPaper, setSelectedHistoryPaper] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null); // 删除状态

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
      console.log('=== 历史记录详情查询 ===');
      console.log('历史记录ID:', paper.id);
      console.log('题目ID列表:', paper.included_question_ids);
      
      const { data: paperDetails, error } = await supabase
        .from('error_questions')
        .select(`
          id,
          question_content,
          knowledge_points,
          correct_answer,
          question_image_url
        `)
        .in('id', paper.included_question_ids || []);

      if (error) throw error;
      console.log('查询到的题目详情:', paperDetails);
      
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

  // 删除历史练习记录
  const deleteHistoryPaper = async (paperId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止事件冒泡，避免触发查看详情
    if (!confirm('确定要删除这条历史练习记录吗？此操作不可恢复！')) {
      return;
    }

    setIsDeleting(paperId);
    try {
      // 删除每日一练记录
      const { error: deletePaperError } = await supabase
        .from('daily_practice')
        .delete()
        .eq('id', paperId);

      if (deletePaperError) throw deletePaperError;

      // 过滤掉已删除的记录
      setDailyPractices(prev => prev.filter(paper => paper.id !== paperId));
      
      // 如果当前打开的是这条记录的详情，关闭详情
      if (selectedHistoryPaper && selectedHistoryPaper.id === paperId) {
        setSelectedHistoryPaper(null);
      }

      alert('历史记录删除成功！');
    } catch (error) {
      alert(`删除失败：${(error as Error).message}`);
      console.error('删除历史记录错误:', error);
    } finally {
      setIsDeleting(null);
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
          // 严格校验图片URL
          const isValidImageUrl = question.question_image_url && 
                                  question.question_image_url.startsWith('https://') &&
                                  question.question_image_url.trim() !== '';
          
          console.log(`题目${index+1} - ID:${question.id}`, {
            hasImageUrl: !!question.question_image_url,
            isValidUrl: isValidImageUrl,
            url: question.question_image_url
          });
          
          return (
            <div key={question.id || `question-${index}`} className="border-b pb-6">
              <h3 className="font-medium text-lg mb-2">
                {index + 1}. {questionContent}
              </h3>
              
              {/* 题目图片（改用原生img标签） */}
              {isValidImageUrl && (
                <div className="my-3 max-w-md">
                  <p className="text-sm text-gray-500 mb-1">题目图片：</p>
                  <div className="border rounded p-1 bg-gray-50">
                    <img
                      src={question.question_image_url}
                      alt={`题目 ${index + 1}`}
                      className="rounded object-contain max-w-full h-auto"
                      style={{ maxHeight: '300px' }}
                      onError={(e) => {
                        const target = e.currentTarget as HTMLImageElement;
                        target.alt = `题目 ${index + 1} 图片加载失败`;
                        target.style.border = '1px solid red';
                        target.style.padding = '2px';
                        console.error(`题目${index+1}图片加载失败`, {
                          url: question.question_image_url,
                          error: e
                        });
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

      {/* 历史记录详情 */}
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

      {/* 历史练习记录 - 表格形式 */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">历史练习记录</h2>
        {dailyPractices && dailyPractices.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse border border-gray-200">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-200 px-4 py-2 text-left text-sm font-medium text-gray-700">序号</th>
                  <th className="border border-gray-200 px-4 py-2 text-left text-sm font-medium text-gray-700">生成时间</th>
                  <th className="border border-gray-200 px-4 py-2 text-left text-sm font-medium text-gray-700">题目数量</th>
                  <th className="border border-gray-200 px-4 py-2 text-left text-sm font-medium text-gray-700">操作</th>
                </tr>
              </thead>
              <tbody>
                {dailyPractices.map((paper, index) => (
                  <tr 
                    key={paper.id || `paper-${Date.now()}`} 
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => viewHistoryPaper(paper)}
                  >
                    <td className="border border-gray-200 px-4 py-2 text-sm">{index + 1}</td>
                    <td className="border border-gray-200 px-4 py-2 text-sm">
                      {new Date(paper.generate_time).toLocaleString()}
                    </td>
                    <td className="border border-gray-200 px-4 py-2 text-sm">
                      {(paper.included_question_ids || []).length} 道
                    </td>
                    <td className="border border-gray-200 px-4 py-2 text-sm">
                      {/* 详情按钮 */}
                      <button 
                        className="text-blue-600 hover:text-blue-800 mr-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          viewHistoryPaper(paper);
                        }}
                      >
                        详情
                      </button>
                      {/* 删除按钮 */}
                      <button 
                        className="text-red-600 hover:text-red-800"
                        onClick={(e) => deleteHistoryPaper(paper.id, e)}
                        disabled={isDeleting === paper.id}
                      >
                        {isDeleting === paper.id ? '删除中...' : '删除'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-600">暂无历史练习记录</p>
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