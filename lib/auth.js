import crypto from 'node:crypto';
import { publicUser, readDb } from './db';

const secret = process.env.AUTH_SECRET || 'local-dev-reader-secret';

export function signToken(user) {
  const payload = Buffer.from(JSON.stringify({
    userId: user.id,
    issuedAt: Date.now()
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifyToken(token) {
  if (!token || !token.includes('.')) return null;
  const [payload, signature] = token.split('.');
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  if (Buffer.byteLength(signature) !== Buffer.byteLength(expected)) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

export function getUserFromRequest(request) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const payload = verifyToken(token);
  if (!payload) return null;
  const db = readDb();
  return db.users.find((user) => user.id === payload.userId) || null;
}

export function requireUser(request) {
  const user = getUserFromRequest(request);
  if (!user) {
    return { error: Response.json({ error: '请先登录' }, { status: 401 }) };
  }
  if ((user.accountStatus || 'active') !== 'active') {
    return { error: Response.json({ error: '账号已停用，请联系管理员' }, { status: 403 }) };
  }
  return { user };
}

export function requireManager(request) {
  const result = requireUser(request);
  if (result.error) return result;
  if (!['admin', 'editor'].includes(result.user.role)) {
    return { error: Response.json({ error: '没有后台权限' }, { status: 403 }) };
  }
  return result;
}

export function requireAdmin(request) {
  const result = requireUser(request);
  if (result.error) return result;
  if (result.user.role !== 'admin') {
    return { error: Response.json({ error: '只有管理员可以管理用户' }, { status: 403 }) };
  }
  return result;
}

export function meResponse(user) {
  return Response.json(publicUser(user));
}
