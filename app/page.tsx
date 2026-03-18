'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Link from 'next/link';

export default function Home() {
  const [errorQuestions, setErrorQuestions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch all error questions
  useEffect(() => {
    const fetchErrorQuestions = async () => {
      const { data, error } = await supabase
        .from('error_questions')
        .select(`
          *,
          error_question_logs(count)
        `)
        .order('create_time', { ascending: false });

      if (error) console.error('Failed to fetch error questions:', error);
      else setErrorQuestions(data || []);
      setIsLoading(false);
    };

    fetchErrorQuestions();
  }, []);

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Child's Error Question Management System</h1>
        <div className="space-x-4">
          <Link 
            href="/add-question" 
            className="bg-blue-500 text-white px-4 py-2 rounded"
          >
            Add Error Question
          </Link>
          <Link 
            href="/daily-practice" 
            className="bg-green-500 text-white px-4 py-2 rounded"
          >
            Generate Daily Practice
          </Link>
        </div>
      </div>

      {isLoading ? (
        <p>Loading...</p>
      ) : errorQuestions.length === 0 ? (
        <p>No error questions yet, please add some!</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          {errorQuestions.map((question) => (
            <div key={question.id} className="border p-4 rounded shadow">
              <h3 className="text-xl font-semibold">
                {question.question_content.substring(0, 50)}
                {question.question_content.length > 50 ? '...' : ''}
              </h3>
              <div className="mt-2">
                <span className="text-gray-600">Knowledge Points:</span>
                {question.knowledge_points.map((tag: string) => (
                  <span key={tag} className="bg-gray-100 px-2 py-1 rounded text-sm mr-1">
                    {tag}
                  </span>
                ))}
              </div>
              <div className="mt-2 text-gray-600 text-sm">
                Selected Count: {question.error_question_logs?.count || 0}
              </div>
              <div className="mt-3 text-gray-500 text-sm">
                Create Time: {new Date(question.create_time).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}