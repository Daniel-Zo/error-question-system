// 标签管理工具函数
import { supabase } from './supabase';

// 获取所有标签
export const getAllTags = async () => {
  const { data, error } = await supabase
    .from('tags')
    .select('id, name')
    .order('name', { ascending: true });
  
  if (error) {
    console.error('获取标签失败:', error);
    return [];
  }
  return data || [];
};

// 添加新标签
export const addNewTag = async (tagName: string) => {
  // 去重检查
  const { data: existingTag } = await supabase
    .from('tags')
    .select('id')
    .eq('name', tagName.trim())
    .single();
  
  if (existingTag) return existingTag.id;

  const { data, error } = await supabase
    .from('tags')
    .insert([{ name: tagName.trim() }])
    .select('id')
    .single();
  
  if (error) {
    console.error('添加标签失败:', error);
    return null;
  }
  return data?.id;
};