import HomePage from '../../page';

export const metadata = {
  title: '资源管理 - 阅声记'
};

export default function AdminResourcesPage() {
  return <HomePage initialTab="admin" initialAdminSection="resources" lockedMode="admin" />;
}
