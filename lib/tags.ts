import { supabase } from './supabase';

export interface Tag {
  id: string;
  name: string;
}

// 获取所有标签
export async function getAllTags(): Promise<Tag[]> {
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('获取标签失败:', error);
    return [];
  }

  return data || [];
}

// 创建新标签（修复缺失的函数）
export async function createTag(name: string): Promise<Tag | null> {
  if (!name) return null;

  const { data, error } = await supabase
    .from('tags')
    .insert([{ name }])
    .select()
    .single();

  if (error) {
    console.error('创建标签失败:', error);
    return null;
  }

  return data;
}