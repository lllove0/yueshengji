import { PDFParse } from 'pdf-parse';

export async function extractPdfText(buffer) {
  const pages = await extractPdfPages(buffer);
  return pages.map((page) => page.text).filter(Boolean).join('\n\n');
}

export async function extractPdfPages(buffer, options = {}) {
  let parser;
  try {
    parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    const pages = result.pages
      .map((page, index) => ({
        id: `page-${index + 1}`,
        pageNumber: page.num || index + 1,
        title: `第 ${page.num || index + 1} 页`,
        text: normalizePdfText(page.text),
        reviewStatus: normalizePdfText(page.text) ? 'pending' : 'pending'
      }))
      .filter((page) => options.includeEmptyPages || page.text);
    if (pages.length || !options.includeEmptyPages) return pages;
    return buildEmptyPdfPages(result.total || 0);
  } catch (error) {
    console.error('PDF parse failed:', error);
    if (!options.includeEmptyPages) return [];
    try {
      const info = await parser?.getInfo();
      return buildEmptyPdfPages(info?.total || 0);
    } catch {
      return [];
    }
  } finally {
    await parser?.destroy();
  }
}

export async function extractPdfPageShells(buffer) {
  const pages = await extractPdfPages(buffer, { includeEmptyPages: true });
  return pages.map((page, index) => ({
    id: page.id || `page-${index + 1}`,
    pageNumber: page.pageNumber || index + 1,
    title: page.title || `第 ${index + 1} 页`,
    text: page.text || '',
    translation: page.translation || '',
    reviewStatus: page.text ? 'pending' : 'pending'
  }));
}

function buildEmptyPdfPages(total) {
  return Array.from({ length: Number(total) || 0 }, (_, index) => ({
    id: `page-${index + 1}`,
    pageNumber: index + 1,
    title: `第 ${index + 1} 页`,
    text: '',
    translation: '',
    reviewStatus: 'pending'
  }));
}

function normalizePdfText(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
