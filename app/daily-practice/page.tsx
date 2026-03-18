'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Link from 'next/link';

// 1. 先定义 Tag 类型（在文件顶部）
interface Tag {
  id: string;
  name: string;
}

// 2. 修正报错的 map 函数（添加 tagId: string 类型注解）
const paperDetailsWithTags = (paperDetails || []).map(question => ({
  ...question,
  tag_names: question.tag_ids.map((tagId: string) =>  // 关键：添加 : string 类型注解
    tags.find(tag => tag.id === tagId)?.name || ''
  ).filter(Boolean)
}));

export default function DailyPractice() {
  const [dailyPractices, setDailyPractices] = useState<any[]>([]);
  const [currentPaper, setCurrentPaper] = useState<any>(null);
  const [selectedHistoryPaper, setSelectedHistoryPaper] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

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

    const { data: paperDetails } = await supabase
      .from('error_questions')
      .select(`
        id,
        question_content,
        tag_ids,
        knowledge_points,
        correct_answer,
        question_image_url,
        correct_answer_image_url
      `)
      .in('id', randomQuestionIds);

    // 关联标签名称（修正类型错误）
    const { data: tags } = await supabase.from('tags').select('id, name');
    // 定义 Tag 类型（如果文件顶部未定义）
    interface Tag {
      id: string;
      name: string;
    }
    const paperDetailsWithTags = (paperDetails || []).map(question => ({
      ...question,
      // 关键：给 tagId 添加 string 类型注解
      tag_names: question.tag_ids.map((tagId: string) => 
        (tags as Tag[]).find(tag => tag.id === tagId)?.name || ''
      ).filter(Boolean)
    }));

    setCurrentPaper({
      ...newPaper,
      questionList: paperDetailsWithTags || [],
    });

    setDailyPractices(prev => [newPaper, ...(prev || [])]);
    alert('每日一练生成成功！');
  } catch (error) {
    alert(`生成失败：${(error as Error).message}`);
    console.error('生成每日一练错误:', error);
  } finally {
    setIsLoading(false);
  }
};

// 查看历史记录详情函数中同样需要修正
const viewHistoryPaper = async (paper: any) => {
  setIsLoadingHistory(true);
  try {
    const { data: tags } = await supabase.from('tags').select('id, name');
    const { data: paperDetails, error } = await supabase
      .from('error_questions')
      .select(`
        id,
        question_content,
        tag_ids,
        knowledge_points,
        correct_answer,
        question_image_url,
        correct_answer_image_url
      `)
      .in('id', paper.included_question_ids || []);

    if (error) throw error;
    
    // 修正这里的类型错误
    interface Tag {
      id: string;
      name: string;
    }
    const paperDetailsWithTags = (paperDetails || []).map(question => ({
      ...question,
      tag_names: question.tag_ids.map((tagId: string) => 
        (tags as Tag[]).find(tag => tag.id === tagId)?.name || ''
      ).filter(Boolean)
    }));

    setSelectedHistoryPaper({
      ...paper,
      questionList: paperDetailsWithTags || [],
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
    e.stopPropagation();
    if (!confirm('确定要删除这条历史练习记录吗？此操作不可恢复！')) {
      return;
    }

    setIsDeleting(paperId);
    try {
      const { error: deletePaperError } = await supabase
        .from('daily_practice')
        .delete()
        .eq('id', paperId);

      if (deletePaperError) throw deletePaperError;

      setDailyPractices(prev => prev.filter(paper => paper.id !== paperId));
      
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

  // 渲染题目列表
  const renderQuestionList = (questionList: any[]) => {
    if (!questionList || questionList.length === 0) {
      return <p className="text-gray-500">暂无题目</p>;
    }

    return (
      <div className="space-y-8 mt-4">
        {questionList.map((question: any, index: number) => {
          const tagNames = question.tag_names || [];
          const questionContent = question.question_content || '无题目内容';
          const isValidImageUrl = question.question_image_url && 
                                  question.question_image_url.startsWith('https://') &&
                                  question.question_image_url.trim() !== '';
          
          return (
            <div key={question.id || `question-${index}`} className="border-b pb-6">
              <h3 className="font-medium text-lg mb-2">
                {index + 1}. {questionContent}
              </h3>
              
              {/* 标签 */}
              <div className="flex flex-wrap gap-1 mb-3">
                {tagNames.map(tag => (
                  <span key={tag} className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
              
              {/* 题目图片 */}
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
                      }}
                    />
                  </div>
                </div>
              )}

              {/* 正确答案 */}
              {question.correct_answer && (
                <div className="mt-2 text-sm">
                  <span className="text-green-600 font-medium">正确答案：</span> {question.correct_answer}
                </div>
              )}
              
              {/* 正确答案图片 */}
              {question.correct_answer_image_url && (
                <div className="my-3 max-w-md">
                  <p className="text-sm text-gray-500 mb-1">答案图片：</p>
                  <div className="border rounded p-1 bg-gray-50">
                    <img
                      src={question.correct_answer_image_url}
                      alt={`答案 ${index + 1}`}
                      className="rounded object-contain max-w-full h-auto"
                      style={{ maxHeight: '300px' }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto">
        {/* 页面头部 */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-800">每日一练</h1>
            <div className="flex gap-3">
              <button
                onClick={generateDailyPractice}
                disabled={isLoading}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-all shadow-md hover:shadow-lg disabled:opacity-70"
              >
                {isLoading ? '生成中...' : '生成新练习题'}
              </button>
              <Link 
                href="/" 
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg transition-all"
              >
                返回首页
              </Link>
            </div>
          </div>
        </div>

        {/* 最新生成的练习题 */}
        {currentPaper && currentPaper.questionList && currentPaper.questionList.length > 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              最新练习题（{new Date(currentPaper.generate_time).toLocaleString('zh-CN')}）
            </h2>
            {renderQuestionList(currentPaper.questionList)}
          </div>
        ) : currentPaper ? (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">每日一练</h2>
            <p className="text-gray-500">本套练习题暂无题目</p>
          </div>
        ) : null}

        {/* 历史记录详情 */}
        {selectedHistoryPaper && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8 relative z-10">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-800">
                历史练习题详情（{new Date(selectedHistoryPaper.generate_time).toLocaleString('zh-CN')}）
              </h2>
              <button
                onClick={closeHistoryPaper}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-1 rounded-lg transition-all"
              >
                关闭
              </button>
            </div>
            {isLoadingHistory ? (
              <p className="text-gray-500 text-center py-4">加载中...</p>
            ) : (
              renderQuestionList(selectedHistoryPaper.questionList)
            )}
          </div>
        )}

        {/* 历史练习记录 - 表格形式 */}
        <div className="bg-white rounded-xl shadow-lg mb-8 overflow-hidden">
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold text-gray-800">历史练习记录</h2>
          </div>

          {dailyPractices && dailyPractices.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">序号</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">生成时间</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">题目数量</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {dailyPractices.map((paper, index) => (
                    <tr 
                      key={paper.id || `paper-${Date.now()}`} 
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => viewHistoryPaper(paper)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{index + 1}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(paper.generate_time).toLocaleString('zh-CN')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {(paper.included_question_ids || []).length} 道
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button 
                          className="text-blue-600 hover:text-blue-800 mr-3 font-medium"
                          onClick={(e) => {
                            e.stopPropagation();
                            viewHistoryPaper(paper);
                          }}
                        >
                          详情
                        </button>
                        <button 
                          className="text-red-600 hover:text-red-800 font-medium"
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
            <div className="p-8 text-center text-gray-500">
              暂无历史练习记录
            </div>
          )}
        </div>
      </div>
    </div>
  );
}