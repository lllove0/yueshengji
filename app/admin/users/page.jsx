import HomePage from '../../page';

export const metadata = {
  title: '用户管理 - 中英文阅读打卡系统'
};

export default function AdminUsersPage() {
  return <HomePage initialTab="admin" initialAdminSection="users" />;
}
