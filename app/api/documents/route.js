import { createDocumentRecord, readDb, writeDb } from '../../../lib/db';
import { requireManager, requireUser } from '../../../lib/auth';

export const runtime = 'nodejs';

export async function GET(request) {
  const result = requireUser(request);
  if (result.error) return result.error;
  const db = readDb();
  return Response.json({ documents: db.documents });
}

export async function POST(request) {
  const result = requireManager(request);
  if (result.error) return result.error;
  const input = await request.json();
  const db = readDb();
  const document = createDocumentRecord({
    ...input,
    ownerId: result.user.id
  });
  db.documents.unshift(document);
  writeDb(db);
  return Response.json({ document }, { status: 201 });
}
