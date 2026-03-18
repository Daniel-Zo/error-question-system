import { createClient } from '@supabase/supabase-js';

// 1. 读取环境变量（添加非空断言 !，告诉TS变量一定有值）
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// 2. 运行时校验（防止环境变量未配置导致运行错误）
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
}

// 3. 创建 Supabase 客户端（此时变量必为字符串，TS 不报错）
export const supabase = createClient(supabaseUrl, supabaseAnonKey);