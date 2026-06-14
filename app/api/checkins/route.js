import crypto from 'node:crypto';
import { readDb, writeDb } from '../../../lib/db';
import { requireUser } from '../../../lib/auth';

export const runtime = 'nodejs';

export async function GET(request) {
  const result = requireUser(request);
  if (result.error) return result.error;
  const db = readDb();
  return Response.json({
    checkins: db.checkins.filter((item) => item.userId === result.user.id)
  });
}

export async function POST(request) {
  const result = requireUser(request);
  if (result.error) return result.error;
  const input = await request.json();
  const db = readDb();
  const document = db.documents.find((item) => item.id === input.documentId);
  if (!document || !document.segments.some((segment) => segment.id === input.segmentId)) {
    return Response.json({ error: '打卡段落不存在' }, { status: 404 });
  }

  const existing = db.checkins.find((item) => (
    item.userId === result.user.id &&
    item.documentId === input.documentId &&
    item.segmentId === input.segmentId
  ));

  if (existing) {
    db.checkins = db.checkins.filter((item) => item !== existing);
  } else {
    db.checkins.push({
      id: crypto.randomUUID(),
      userId: result.user.id,
      documentId: input.documentId,
      segmentId: input.segmentId,
      date: todayKey(),
      createdAt: new Date().toISOString()
    });
  }

  writeDb(db);
  return Response.json({
    checkins: db.checkins.filter((item) => item.userId === result.user.id)
  });
}

function todayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
