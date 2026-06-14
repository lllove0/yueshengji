import HomePage from '../../page';

export const metadata = {
  title: '用户管理 - 阅声记'
};

export default function AdminUsersPage() {
  return <HomePage initialTab="admin" initialAdminSection="users" lockedMode="admin" />;
}
