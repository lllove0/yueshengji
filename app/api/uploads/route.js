import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createDocumentRecord, readDb, uploadPath, writeDb } from '../../../lib/db';
import { requireManager } from '../../../lib/auth';

export const runtime = 'nodejs';

export async function POST(request) {
  const result = requireManager(request);
  if (result.error) return result.error;

  const formData = await request.formData();
  const file = formData.get('file');
  const title = String(formData.get('title') || '').trim();
  if (!file || typeof file === 'string') {
    return Response.json({ error: '没有上传文件' }, { status: 400 });
  }

  const originalName = file.name || 'upload';
  const ext = path.extname(originalName).toLowerCase();
  const isText = file.type.startsWith('text/') || ['.txt', '.md'].includes(ext);
  const isPdf = file.type === 'application/pdf' || ext === '.pdf';
  if (!isText && !isPdf) {
    return Response.json({ error: '只支持 TXT、MD 或 PDF' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const target = uploadPath(originalName);
  fs.writeFileSync(target.absolute, buffer);

  const db = readDb();
  const document = createDocumentRecord({
    title: title || originalName.replace(/\.[^.]+$/, ''),
    language: 'bilingual',
    content: isText
      ? buffer.toString('utf8')
      : `PDF 文件已上传：${originalName}\n\n请在后台编辑原文，或后续接入 PDF 解析库自动抽取文字。`,
    translation: '',
    sourceType: isText ? 'text' : 'pdf',
    fileName: originalName,
    filePath: target.relative,
    ownerId: result.user.id
  });

  db.documents.unshift(document);
  db.uploads.unshift({
    id: crypto.randomUUID(),
    fileName: originalName,
    filePath: target.relative,
    mimeType: file.type || 'application/octet-stream',
    uploadedBy: result.user.id,
    createdAt: new Date().toISOString()
  });
  writeDb(db);
  return Response.json({ document }, { status: 201 });
}
