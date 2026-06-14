import { hashPassword, publicUser, readDb, writeDb } from '../../../../lib/db';
import { requireAdmin } from '../../../../lib/auth';

export const runtime = 'nodejs';

export async function PUT(request, { params }) {
  const result = requireAdmin(request);
  if (result.error) return result.error;
  const { id } = await params;
  const input = await request.json();
  const db = readDb();
  const user = db.users.find((item) => item.id === id);
  if (!user) {
    return Response.json({ error: '用户不存在' }, { status: 404 });
  }

  const role = ['admin', 'editor', 'reader'].includes(input.role) ? input.role : user.role;
  const adminCount = db.users.filter((item) => item.role === 'admin').length;
  if (user.role === 'admin' && role !== 'admin' && adminCount <= 1) {
    return Response.json({ error: '至少保留一个管理员' }, { status: 400 });
  }

  user.role = role;
  const password = String(input.password || '');
  if (password) {
    if (password.length < 4) {
      return Response.json({ error: '密码至少 4 位' }, { status: 400 });
    }
    user.passwordHash = hashPassword(password, user.salt);
  }
  user.updatedAt = new Date().toISOString();
  writeDb(db);
  return Response.json({ user: publicUser(user) });
}

export async function DELETE(request, { params }) {
  const result = requireAdmin(request);
  if (result.error) return result.error;
  const { id } = await params;
  if (id === result.user.id) {
    return Response.json({ error: '不能删除当前登录的管理员账号' }, { status: 400 });
  }

  const db = readDb();
  const user = db.users.find((item) => item.id === id);
  if (!user) {
    return Response.json({ error: '用户不存在' }, { status: 404 });
  }
  if (user.role === 'admin' && db.users.filter((item) => item.role === 'admin').length <= 1) {
    return Response.json({ error: '至少保留一个管理员' }, { status: 400 });
  }

  db.users = db.users.filter((item) => item.id !== id);
  db.checkins = db.checkins.filter((item) => item.userId !== id);
  writeDb(db);
  return Response.json({ ok: true });
}
