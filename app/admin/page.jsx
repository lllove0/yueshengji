import HomePage from '../page';

export const metadata = {
  title: '管理后台 - 阅声记'
};

export default function AdminPage() {
  return <HomePage initialTab="admin" initialAdminSection="resources" lockedMode="admin" />;
}
