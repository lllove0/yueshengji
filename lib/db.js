import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const dataDir = path.join(root, 'data');
const uploadDir = path.join(root, 'uploads');
const dbFile = path.join(dataDir, 'app-db.json');
const validLanguages = ['zh', 'en', 'bilingual'];
const validSourceTypes = ['text', 'pdf', 'image'];
const validStatuses = ['draft', 'published', 'needs_review', 'archived'];
const validVisibility = ['private', 'members', 'public'];
const validParseStatuses = ['parsed', 'needs_review', 'failed'];

export function ensureStorage() {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(uploadDir, { recursive: true });
  if (!fs.existsSync(dbFile)) {
    writeDb(seedDb());
  }
}

export function readDb() {
  ensureStorage();
  return JSON.parse(fs.readFileSync(dbFile, 'utf8'));
}

export function writeDb(db) {
  fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));
}

export function createUserRecord(username, password, role = 'reader') {
  const salt = crypto.randomBytes(12).toString('hex');
  return {
    id: crypto.randomUUID(),
    username,
    role,
    passwordHash: hashPassword(password, salt),
    salt,
    createdAt: new Date().toISOString()
  };
}

export function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(String(password), salt, 100000, 32, 'sha256').toString('hex');
}

export function verifyPassword(password, user) {
  return hashPassword(password, user.salt) === user.passwordHash;
}

export function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    createdAt: user.createdAt
  };
}

export function createDocumentRecord(input) {
  const now = new Date().toISOString();
  const content = String(input.content || '').trim();
  const translation = String(input.translation || '').trim();
  const chunkSize = Math.min(2000, Math.max(80, Number(input.chunkSize) || 260));
  const sourceType = validSourceTypes.includes(input.sourceType) ? input.sourceType : 'text';
  const defaultParseStatus = sourceType === 'text' ? 'parsed' : 'needs_review';
  return {
    id: input.id || crypto.randomUUID(),
    title: String(input.title || '未命名内容').trim(),
    language: validLanguages.includes(input.language) ? input.language : 'bilingual',
    category: String(input.category || '未分类').trim(),
    description: String(input.description || '').trim(),
    status: validStatuses.includes(input.status) ? input.status : 'published',
    visibility: validVisibility.includes(input.visibility) ? input.visibility : 'members',
    content,
    translation,
    chunkSize,
    sourceType,
    parseStatus: validParseStatuses.includes(input.parseStatus) ? input.parseStatus : defaultParseStatus,
    fileName: input.fileName || '',
    filePath: input.filePath || '',
    ownerId: input.ownerId || '',
    segments: buildSegments(content, translation, chunkSize),
    createdAt: input.createdAt || now,
    updatedAt: now
  };
}

export function buildSegments(content, translation, chunkSize) {
  const sourceParts = splitText(content, chunkSize);
  const translationParts = splitText(translation, chunkSize);
  return sourceParts.map((text, index) => ({
    id: `seg-${index + 1}`,
    text,
    translation: translationParts[index] || ''
  }));
}

export function splitText(text, chunkSize) {
  const blocks = String(text || '')
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
  const chunks = [];
  for (const block of blocks.length ? blocks : [String(text || '').trim()].filter(Boolean)) {
    if (block.length <= chunkSize) {
      chunks.push(block);
      continue;
    }
    const sentences = block.match(/[^。！？.!?]+[。！？.!?]?/g) || [block];
    let current = '';
    for (const sentence of sentences) {
      const next = `${current}${sentence}`.trim();
      if (next.length <= chunkSize || !current) {
        current = next;
      } else {
        chunks.push(current);
        current = sentence.trim();
      }
    }
    if (current) chunks.push(current);
  }
  return chunks.length ? chunks : ['等待编辑文本后生成打卡段落。'];
}

export function seedDb() {
  const admin = createUserRecord('admin', 'admin123', 'admin');
  const reader = createUserRecord('reader', 'reader123', 'reader');
  return {
    users: [admin, reader],
    documents: [
      createDocumentRecord({
        title: '静夜思 / Thoughts on a Silent Night',
        language: 'bilingual',
        content: '床前明月光，疑是地上霜。\n举头望明月，低头思故乡。\n\nBefore my bed, the moonlight glows.\nI think it frost upon the ground.\nI raise my head and view the bright moon.\nThen lower it, thinking of home.',
        translation: '这是一首适合中英文对照朗读和背诵的示例内容。',
        chunkSize: 120,
        category: '古诗词',
        description: '内置示例资源，可用于测试中英文阅读、朗读和打卡流程。',
        status: 'published',
        visibility: 'members',
        ownerId: admin.id
      })
    ],
    checkins: [],
    uploads: []
  };
}

export function uploadPath(fileName) {
  const safeName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${path.extname(fileName) || '.upload'}`;
  return {
    absolute: path.join(uploadDir, safeName),
    relative: path.join('uploads', safeName)
  };
}
