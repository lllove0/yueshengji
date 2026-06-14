import { PDFParse } from 'pdf-parse';

export async function extractPdfText(buffer) {
  const pages = await extractPdfPages(buffer);
  return pages.map((page) => page.text).filter(Boolean).join('\n\n');
}

export async function extractPdfPages(buffer) {
  let parser;
  try {
    parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    return result.pages
      .map((page, index) => ({
        id: `page-${index + 1}`,
        pageNumber: page.num || index + 1,
        title: `第 ${page.num || index + 1} 页`,
        text: normalizePdfText(page.text)
      }))
      .filter((page) => page.text);
  } catch (error) {
    console.error('PDF parse failed:', error);
    return [];
  } finally {
    await parser?.destroy();
  }
}

function normalizePdfText(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
