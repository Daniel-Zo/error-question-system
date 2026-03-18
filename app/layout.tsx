import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

// 全局元数据改为中文
export const metadata: Metadata = {
  title: '错题管理系统',
  description: '儿童错题管理与每日练习题生成系统',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN"> {/* 改为中文语言 */}
      <body className={inter.className}>{children}</body>
    </html>
  );
}