import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';

const root = process.cwd();
const dataDir = path.join(root, 'data');
const uploadDir = path.join(root, 'uploads');
const legacyDbFile = path.join(dataDir, 'app-db.json');
const sqliteFile = path.join(dataDir, 'yueshengji.sqlite');
let sqlite;
const validLanguages = ['zh', 'en', 'bilingual'];
const validSourceTypes = ['text', 'pdf', 'image'];
const validStatuses = ['draft', 'published', 'needs_review', 'archived'];
const validVisibility = ['private', 'members', 'public'];
const validParseStatuses = ['parsed', 'needs_review', 'failed'];
const validPlans = ['free', 'pro', 'team'];
const validAccountStatuses = ['active', 'suspended'];
const validAccessLevels = ['free', 'member', 'paid'];

export function ensureStorage() {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(uploadDir, { recursive: true });
  const db = getSqlite();
  if (db.prepare('SELECT COUNT(*) AS count FROM users').get().count === 0) {
    writeDb(fs.existsSync(legacyDbFile)
      ? JSON.parse(fs.readFileSync(legacyDbFile, 'utf8'))
      : seedDb());
  }
}

export function readDb() {
  ensureStorage();
  const db = getSqlite();
  return {
    users: db.prepare('SELECT * FROM users ORDER BY createdAt ASC').all(),
    documents: db.prepare('SELECT * FROM documents ORDER BY createdAt DESC').all().map(rowToDocument),
    checkins: db.prepare('SELECT * FROM checkins ORDER BY createdAt DESC').all(),
    uploads: db.prepare('SELECT * FROM uploads ORDER BY createdAt DESC').all()
  };
}

export function writeDb(db) {
  const sqliteDb = getSqlite();
  const replaceAll = sqliteDb.transaction((nextDb) => {
    sqliteDb.prepare('DELETE FROM users').run();
    sqliteDb.prepare('DELETE FROM documents').run();
    sqliteDb.prepare('DELETE FROM checkins').run();
    sqliteDb.prepare('DELETE FROM uploads').run();

    const insertUser = sqliteDb.prepare(`
      INSERT INTO users (
        id, username, role, plan, accountStatus, subscriptionEndsAt,
        passwordHash, salt, createdAt, updatedAt
      ) VALUES (
        @id, @username, @role, @plan, @accountStatus, @subscriptionEndsAt,
        @passwordHash, @salt, @createdAt, @updatedAt
      )
    `);
    const insertDocument = sqliteDb.prepare(`
      INSERT INTO documents (
        id, title, language, category, description, status, visibility,
        accessLevel, priceCents, content, translation, chunkSize, sourceType,
        parseStatus, fileName, filePath, ownerId, pagesJson, segmentsJson,
        createdAt, updatedAt
      ) VALUES (
        @id, @title, @language, @category, @description, @status, @visibility,
        @accessLevel, @priceCents, @content, @translation, @chunkSize, @sourceType,
        @parseStatus, @fileName, @filePath, @ownerId, @pagesJson, @segmentsJson,
        @createdAt, @updatedAt
      )
    `);
    const insertCheckin = sqliteDb.prepare(`
      INSERT INTO checkins (id, userId, documentId, segmentId, date, createdAt)
      VALUES (@id, @userId, @documentId, @segmentId, @date, @createdAt)
    `);
    const insertUpload = sqliteDb.prepare(`
      INSERT INTO uploads (id, fileName, filePath, mimeType, sourceType, parseStatus, uploadedBy, createdAt)
      VALUES (@id, @fileName, @filePath, @mimeType, @sourceType, @parseStatus, @uploadedBy, @createdAt)
    `);

    for (const user of nextDb.users || []) {
      insertUser.run({
        id: user.id,
        username: user.username,
        role: user.role || 'reader',
        plan: user.plan || 'free',
        accountStatus: user.accountStatus || 'active',
        subscriptionEndsAt: user.subscriptionEndsAt || '',
        passwordHash: user.passwordHash,
        salt: user.salt,
        createdAt: user.createdAt || new Date().toISOString(),
        updatedAt: user.updatedAt || ''
      });
    }
    for (const document of nextDb.documents || []) {
      const normalized = createDocumentRecord(document);
      insertDocument.run(documentToRow(normalized));
    }
    for (const checkin of nextDb.checkins || []) {
      insertCheckin.run({
        id: checkin.id,
        userId: checkin.userId,
        documentId: checkin.documentId,
        segmentId: checkin.segmentId,
        date: checkin.date,
        createdAt: checkin.createdAt || new Date().toISOString()
      });
    }
    for (const upload of nextDb.uploads || []) {
      insertUpload.run({
        id: upload.id,
        fileName: upload.fileName || '',
        filePath: upload.filePath || '',
        mimeType: upload.mimeType || 'application/octet-stream',
        sourceType: upload.sourceType || '',
        parseStatus: upload.parseStatus || '',
        uploadedBy: upload.uploadedBy || '',
        createdAt: upload.createdAt || new Date().toISOString()
      });
    }
  });
  replaceAll(db);
}

function getSqlite() {
  if (sqlite) return sqlite;
  fs.mkdirSync(dataDir, { recursive: true });
  sqlite = new Database(sqliteFile);
  sqlite.pragma('journal_mode = WAL');
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL,
      plan TEXT NOT NULL DEFAULT 'free',
      accountStatus TEXT NOT NULL DEFAULT 'active',
      subscriptionEndsAt TEXT NOT NULL DEFAULT '',
      passwordHash TEXT NOT NULL,
      salt TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      language TEXT NOT NULL DEFAULT 'bilingual',
      category TEXT NOT NULL DEFAULT '未分类',
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'published',
      visibility TEXT NOT NULL DEFAULT 'members',
      accessLevel TEXT NOT NULL DEFAULT 'member',
      priceCents INTEGER NOT NULL DEFAULT 0,
      content TEXT NOT NULL DEFAULT '',
      translation TEXT NOT NULL DEFAULT '',
      chunkSize INTEGER NOT NULL DEFAULT 260,
      sourceType TEXT NOT NULL DEFAULT 'text',
      parseStatus TEXT NOT NULL DEFAULT 'parsed',
      fileName TEXT NOT NULL DEFAULT '',
      filePath TEXT NOT NULL DEFAULT '',
      ownerId TEXT NOT NULL DEFAULT '',
      pagesJson TEXT NOT NULL DEFAULT '[]',
      segmentsJson TEXT NOT NULL DEFAULT '[]',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS checkins (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      documentId TEXT NOT NULL,
      segmentId TEXT NOT NULL,
      date TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS uploads (
      id TEXT PRIMARY KEY,
      fileName TEXT NOT NULL DEFAULT '',
      filePath TEXT NOT NULL DEFAULT '',
      mimeType TEXT NOT NULL DEFAULT 'application/octet-stream',
      sourceType TEXT NOT NULL DEFAULT '',
      parseStatus TEXT NOT NULL DEFAULT '',
      uploadedBy TEXT NOT NULL DEFAULT '',
      createdAt TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_documents_createdAt ON documents(createdAt);
    CREATE INDEX IF NOT EXISTS idx_checkins_userId ON checkins(userId);
    CREATE INDEX IF NOT EXISTS idx_checkins_documentId ON checkins(documentId);
  `);
  return sqlite;
}

function rowToDocument(row) {
  return {
    id: row.id,
    title: row.title,
    language: row.language,
    category: row.category,
    description: row.description,
    status: row.status,
    visibility: row.visibility,
    accessLevel: row.accessLevel,
    priceCents: row.priceCents,
    content: row.content,
    translation: row.translation,
    chunkSize: row.chunkSize,
    sourceType: row.sourceType,
    parseStatus: row.parseStatus,
    fileName: row.fileName,
    filePath: row.filePath,
    ownerId: row.ownerId,
    pages: parseJson(row.pagesJson, []),
    segments: parseJson(row.segmentsJson, []),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function documentToRow(document) {
  return {
    id: document.id,
    title: document.title,
    language: document.language,
    category: document.category,
    description: document.description,
    status: document.status,
    visibility: document.visibility,
    accessLevel: document.accessLevel,
    priceCents: document.priceCents,
    content: document.content,
    translation: document.translation,
    chunkSize: document.chunkSize,
    sourceType: document.sourceType,
    parseStatus: document.parseStatus,
    fileName: document.fileName,
    filePath: document.filePath,
    ownerId: document.ownerId,
    pagesJson: JSON.stringify(document.pages || []),
    segmentsJson: JSON.stringify(document.segments || []),
    createdAt: document.createdAt,
    updatedAt: document.updatedAt
  };
}

function parseJson(value, fallback) {
  try {
    return JSON.parse(value || '');
  } catch {
    return fallback;
  }
}

export function createUserRecord(username, password, role = 'reader', options = {}) {
  const salt = crypto.randomBytes(12).toString('hex');
  return {
    id: crypto.randomUUID(),
    username,
    role,
    plan: validPlans.includes(options.plan) ? options.plan : 'free',
    accountStatus: validAccountStatuses.includes(options.accountStatus) ? options.accountStatus : 'active',
    subscriptionEndsAt: options.subscriptionEndsAt || '',
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
    plan: user.plan || 'free',
    accountStatus: user.accountStatus || 'active',
    subscriptionEndsAt: user.subscriptionEndsAt || '',
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
  const pages = buildPages(input.pages, content, translation, chunkSize);
  return {
    id: input.id || crypto.randomUUID(),
    title: String(input.title || '未命名内容').trim(),
    language: validLanguages.includes(input.language) ? input.language : 'bilingual',
    category: String(input.category || '未分类').trim(),
    description: String(input.description || '').trim(),
    status: validStatuses.includes(input.status) ? input.status : 'published',
    visibility: validVisibility.includes(input.visibility) ? input.visibility : 'members',
    accessLevel: validAccessLevels.includes(input.accessLevel) ? input.accessLevel : 'member',
    priceCents: Math.max(0, Number(input.priceCents) || 0),
    content,
    translation,
    chunkSize,
    sourceType,
    parseStatus: validParseStatuses.includes(input.parseStatus) ? input.parseStatus : defaultParseStatus,
    fileName: input.fileName || '',
    filePath: input.filePath || '',
    ownerId: input.ownerId || '',
    pages,
    segments: pages.flatMap((page) => page.blocks),
    createdAt: input.createdAt || now,
    updatedAt: now
  };
}

export function buildSegments(content, translation, chunkSize) {
  const sourceParts = splitText(content, chunkSize);
  const translationParts = String(translation || '').trim() ? splitText(translation, chunkSize) : [];
  return sourceParts.map((text, index) => ({
    id: `seg-${index + 1}`,
    text,
    translation: translationParts[index] || ''
  }));
}

export function buildPages(inputPages, content, translation, chunkSize) {
  if (Array.isArray(inputPages) && inputPages.length) {
    return inputPages.map((page, pageIndex) => {
      const pageText = String(page.text || '').trim();
      const pageTranslation = String(page.translation || '').trim();
      return {
        id: page.id || `page-${pageIndex + 1}`,
        pageNumber: Number(page.pageNumber) || pageIndex + 1,
        title: String(page.title || `第 ${pageIndex + 1} 页`).trim(),
        text: pageText,
        translation: pageTranslation,
        reviewStatus: ['pending', 'reviewed', 'skipped'].includes(page.reviewStatus) ? page.reviewStatus : 'pending',
        blocks: buildSegments(pageText, pageTranslation, chunkSize).map((block, blockIndex) => ({
          ...block,
          id: `page-${pageIndex + 1}-seg-${blockIndex + 1}`,
          pageId: page.id || `page-${pageIndex + 1}`,
          pageNumber: Number(page.pageNumber) || pageIndex + 1
        }))
      };
    });
  }

  return [
    {
      id: 'page-1',
      pageNumber: 1,
      title: '第 1 页',
      text: content,
      translation,
      reviewStatus: 'pending',
      blocks: buildSegments(content, translation, chunkSize).map((block, index) => ({
        ...block,
        id: `page-1-seg-${index + 1}`,
        pageId: 'page-1',
        pageNumber: 1
      }))
    }
  ];
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
        accessLevel: 'free',
        priceCents: 0,
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
