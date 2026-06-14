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
  return Response.json({
    token: signToken(user),
    user: publicUser(user)
  });
}
