import { createUserRecord, publicUser, readDb, writeDb } from '../../../lib/db';
import { requireAdmin } from '../../../lib/auth';

export const runtime = 'nodejs';

export async function GET(request) {
  const result = requireAdmin(request);
  if (result.error) return result.error;
  const db = readDb();
  return Response.json({ users: db.users.map(publicUser) });
}

export async function POST(request) {
  const result = requireAdmin(request);
  if (result.error) return result.error;
  const input = await request.json();
  const username = String(input.username || '').trim();
  const password = String(input.password || '');
  const role = ['admin', 'editor', 'reader'].includes(input.role) ? input.role : 'reader';
  const plan = ['free', 'pro', 'team'].includes(input.plan) ? input.plan : 'free';
  const accountStatus = ['active', 'suspended'].includes(input.accountStatus) ? input.accountStatus : 'active';
  if (!username || password.length < 4) {
    return Response.json({ error: '用户名不能为空，密码至少 4 位' }, { status: 400 });
  }

  const db = readDb();
  if (db.users.some((user) => user.username === username)) {
    return Response.json({ error: '用户已存在' }, { status: 409 });
  }
  const user = createUserRecord(username, password, role, {
    plan,
    accountStatus,
    subscriptionEndsAt: String(input.subscriptionEndsAt || '').trim()
  });
  db.users.push(user);
  writeDb(db);
  return Response.json({ user: publicUser(user) }, { status: 201 });
}
