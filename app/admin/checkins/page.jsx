import HomePage from '../../page';

export const metadata = {
  title: '打卡记录 - 中英文阅读打卡系统'
};

export default function AdminCheckinsPage() {
  return <HomePage initialTab="admin" initialAdminSection="checkins" />;
}
