import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css'; // 全局样式文件（需同步创建）

// 配置全局字体（可选，提升样式体验）
const inter = Inter({ subsets: ['latin'] });

// 全局页面元数据（SEO 相关）
export const metadata: Metadata = {
  title: 'Error Question Management System',
  description: 'A system to manage childrens error questions and generate daily practice papers',
};

// 根布局组件（所有页面的父容器）
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}