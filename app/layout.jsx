import './globals.css';

export const metadata = {
  title: '阅声记',
  description: '中英文阅读与语音打卡系统，支持上传文本、PDF、图片、资源管理、用户管理和阅读打卡。'
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
