import fs from 'node:fs';
import path from 'node:path';
import { createDocumentRecord, readDb, writeDb } from '../../../../../lib/db';
import { extractPdfPages } from '../../../../../lib/pdf';
import { requireManager } from '../../../../../lib/auth';

export const runtime = 'nodejs';

export async function POST(request, { params }) {
  const result = requireManager(request);
  if (result.error) return result.error;
  const { id } = await params;
  const db = readDb();
  const index = db.documents.findIndex((document) => document.id === id);
  if (index === -1) {
    return Response.json({ error: '资源不存在' }, { status: 404 });
  }

  const document = db.documents[index];
  if (document.sourceType !== 'pdf' || !document.filePath) {
    return Response.json({ error: '只有已上传的 PDF 资源可以重新解析' }, { status: 400 });
  }

  const absolutePath = path.join(process.cwd(), 'uploads', path.basename(document.filePath));
  if (!fs.existsSync(absolutePath)) {
    return Response.json({ error: '原始 PDF 文件不存在' }, { status: 404 });
  }

  const pages = await extractPdfPages(fs.readFileSync(absolutePath));
  if (!pages.length) {
    return Response.json({ error: '未能抽取文字，可能是扫描版 PDF，需要 OCR' }, { status: 422 });
  }

  db.documents[index] = createDocumentRecord({
    ...document,
    content: pages.map((page) => page.text).join('\n\n'),
    pages,
    status: 'published',
    parseStatus: 'parsed',
    description: '已自动抽取 PDF 文本，可在后台继续校对和编辑。'
  });
  writeDb(db);
  return Response.json({ document: db.documents[index] });
}
