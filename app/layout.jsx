import './globals.css';

export const metadata = {
  title: '中英文阅读打卡系统',
  description: '支持中英文阅读、上传文本/PDF、内容编辑、用户管理和阅读打卡。'
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
