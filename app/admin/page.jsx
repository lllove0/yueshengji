import HomePage from '../page';

export const metadata = {
  title: '管理后台 - 中英文阅读打卡系统'
};

export default function AdminPage() {
  return <HomePage initialTab="admin" />;
}
