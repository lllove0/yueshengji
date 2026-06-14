import { publicUser, readDb, verifyPassword } from '../../../lib/db';
import { signToken } from '../../../lib/auth';

export const runtime = 'nodejs';

export async function POST(request) {
  const body = await request.json();
  const db = readDb();
  const user = db.users.find((item) => item.username === String(body.username || '').trim());
  if (!user || !verifyPassword(String(body.password || ''), user)) {
    return Response.json({ error: '用户名或密码错误' }, { status: 401 });
  }
  if ((user.accountStatus || 'active') !== 'active') {
    return Response.json({ error: '账号已停用，请联系管理员' }, { status: 403 });
  }
  return Response.json({
    token: signToken(user),
    user: publicUser(user)
  });
}
