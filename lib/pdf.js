import { PDFParse } from 'pdf-parse';

export async function extractPdfText(buffer) {
  let parser;
  try {
    parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    return normalizePdfText(result.text);
  } catch (error) {
    console.error('PDF parse failed:', error);
    return '';
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
