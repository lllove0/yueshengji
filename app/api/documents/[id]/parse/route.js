import fs from 'node:fs';
import path from 'node:path';
import { createDocumentRecord, readDb, writeDb } from '../../../../../lib/db';
import { extractPdfPageShells, extractPdfPages } from '../../../../../lib/pdf';
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

  const buffer = fs.readFileSync(absolutePath);
  const pages = await extractPdfPages(buffer);
  if (!pages.length) {
    const emptyPages = await extractPdfPageShells(buffer);
    db.documents[index] = createDocumentRecord({
      ...document,
      content: document.content || `PDF 文件已上传：${document.fileName}\n\n未能自动抽取文字。若这是扫描版 PDF，请在内容校对中按页补录文字，后续可接入 OCR 自动识别。`,
      pages: emptyPages.length ? emptyPages : document.pages,
      status: 'needs_review',
      parseStatus: 'needs_review',
      description: emptyPages.length
        ? `未能自动抽取文字，已生成 ${emptyPages.length} 个待校对页面。`
        : '未能自动抽取文字，请在内容校对中补录文字。'
    });
    writeDb(db);
    return Response.json({ document: db.documents[index], warning: '未能抽取文字，已转入页面校对' });
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
