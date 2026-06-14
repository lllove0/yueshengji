import HomePage from '../../page';

export const metadata = {
  title: '打卡记录 - 阅声记'
};

export default function AdminCheckinsPage() {
  return <HomePage initialTab="admin" initialAdminSection="checkins" />;
}
