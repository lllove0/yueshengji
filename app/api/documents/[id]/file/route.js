import fs from 'node:fs';
import path from 'node:path';
import { readDb } from '../../../../../lib/db';
import { requireUser } from '../../../../../lib/auth';

export const runtime = 'nodejs';

const mimeByExt = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif'
};

export async function GET(request, { params }) {
  const result = requireUser(request);
  if (result.error) return result.error;
  const { id } = await params;
  const db = readDb();
  const document = db.documents.find((item) => item.id === id);
  if (!document?.filePath) {
    return Response.json({ error: '资源没有原始文件' }, { status: 404 });
  }

  const fileName = path.basename(document.filePath);
  const absolutePath = path.join(process.cwd(), 'uploads', fileName);
  if (!fs.existsSync(absolutePath)) {
    return Response.json({ error: '原始文件不存在' }, { status: 404 });
  }

  const ext = path.extname(fileName).toLowerCase();
  const mimeType = mimeByExt[ext] || 'application/octet-stream';
  return new Response(fs.readFileSync(absolutePath), {
    headers: {
      'Content-Type': mimeType,
      'Content-Disposition': `inline; filename="${encodeURIComponent(document.fileName || fileName)}"`
    }
  });
}
