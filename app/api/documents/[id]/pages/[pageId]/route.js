import { createDocumentRecord, readDb, writeDb } from '../../../../../../lib/db';
import { requireManager } from '../../../../../../lib/auth';

export const runtime = 'nodejs';

export async function PUT(request, { params }) {
  const result = requireManager(request);
  if (result.error) return result.error;
  const { id, pageId } = await params;
  const input = await request.json();
  const db = readDb();
  const index = db.documents.findIndex((document) => document.id === id);
  if (index === -1) {
    return Response.json({ error: '资源不存在' }, { status: 404 });
  }

  const document = db.documents[index];
  const pages = Array.isArray(document.pages) && document.pages.length
    ? document.pages
    : [{
      id: 'page-1',
      pageNumber: 1,
      title: '第 1 页',
      text: document.content || '',
      translation: document.translation || ''
    }];
  const pageIndex = pages.findIndex((page) => page.id === pageId);
  if (pageIndex === -1) {
    return Response.json({ error: '页面不存在' }, { status: 404 });
  }

  const nextPages = pages.map((page, currentIndex) => currentIndex === pageIndex
    ? {
      ...page,
      text: String(input.text || '').trim(),
      translation: String(input.translation || '').trim(),
      reviewStatus: ['pending', 'reviewed', 'skipped'].includes(input.reviewStatus)
        ? input.reviewStatus
        : page.reviewStatus || 'reviewed'
    }
    : page);

  db.documents[index] = createDocumentRecord({
    ...document,
    pages: nextPages,
    content: nextPages.map((page) => page.text).filter(Boolean).join('\n\n'),
    translation: nextPages.map((page) => page.translation).filter(Boolean).join('\n\n'),
    parseStatus: 'parsed',
    status: document.status === 'needs_review' ? 'published' : document.status
  });
  writeDb(db);
  return Response.json({ document: db.documents[index] });
}
