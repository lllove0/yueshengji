import { createDocumentRecord, readDb, writeDb } from '../../../../lib/db';
import { requireManager } from '../../../../lib/auth';

export const runtime = 'nodejs';

export async function PUT(request, { params }) {
  const result = requireManager(request);
  if (result.error) return result.error;
  const { id } = await params;
  const input = await request.json();
  const db = readDb();
  const index = db.documents.findIndex((document) => document.id === id);
  if (index === -1) {
    return Response.json({ error: '内容不存在' }, { status: 404 });
  }
  db.documents[index] = createDocumentRecord({
    ...db.documents[index],
    ...input,
    id: db.documents[index].id,
    createdAt: db.documents[index].createdAt,
    ownerId: db.documents[index].ownerId
  });
  writeDb(db);
  return Response.json({ document: db.documents[index] });
}

export async function DELETE(request, { params }) {
  const result = requireManager(request);
  if (result.error) return result.error;
  const { id } = await params;
  const db = readDb();
  db.documents = db.documents.filter((document) => document.id !== id);
  db.checkins = db.checkins.filter((item) => item.documentId !== id);
  writeDb(db);
  return Response.json({ ok: true });
}
