import HomePage from '../../page';

export const metadata = {
  title: '资源管理 - 中英文阅读打卡系统'
};

export default function AdminResourcesPage() {
  return <HomePage initialTab="admin" initialAdminSection="resources" />;
}
