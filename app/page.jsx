'use client';

import { useEffect, useMemo, useState } from 'react';

const roleLabel = {
  admin: '管理员',
  editor: '编辑',
  reader: '用户'
};

const languageLabel = {
  bilingual: '中英文',
  zh: '中文',
  en: '英文'
};

const sourceTypeLabel = {
  text: '文本',
  pdf: 'PDF',
  image: '图片'
};

const statusLabel = {
  draft: '草稿',
  published: '已发布',
  needs_review: '待处理',
  archived: '已归档'
};

const visibilityLabel = {
  private: '私有',
  members: '登录可见',
  public: '公开'
};

const emptyEditor = {
  id: '',
  title: '',
  language: 'bilingual',
  category: '未分类',
  description: '',
  status: 'published',
  visibility: 'members',
  content: '',
  translation: '',
  chunkSize: 260
};

export default function HomePage({ initialTab = 'reader' }) {
  const [token, setToken] = useState('');
  const [user, setUser] = useState(null);
  const [loginForm, setLoginForm] = useState({ username: 'admin', password: 'admin123' });
  const [loginMessage, setLoginMessage] = useState('');
  const [documents, setDocuments] = useState([]);
  const [checkins, setCheckins] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState('');
  const [selectedSegmentId, setSelectedSegmentId] = useState('');
  const [activeTab, setActiveTab] = useState(initialTab);
  const [editor, setEditor] = useState(emptyEditor);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'reader' });
  const [uploadTitle, setUploadTitle] = useState('');
  const [message, setMessage] = useState('');
  const [audioStatus, setAudioStatus] = useState('idle');

  const canManage = user && ['admin', 'editor'].includes(user.role);
  const canAdmin = user?.role === 'admin';
  const selectedDocument = documents.find((document) => document.id === selectedDocumentId) || null;
  const selectedSegment = selectedDocument?.segments.find((segment) => segment.id === selectedSegmentId)
    || selectedDocument?.segments[0]
    || null;

  const checkedSegmentIds = useMemo(() => {
    const map = new Map();
    for (const item of checkins) {
      if (!map.has(item.documentId)) map.set(item.documentId, new Set());
      map.get(item.documentId).add(item.segmentId);
    }
    return map;
  }, [checkins]);

  const todayCount = checkins.filter((item) => item.date === todayKey()).length;
  const streak = calculateStreak(checkins);
  const progress = selectedDocument
    ? Math.round(((checkedSegmentIds.get(selectedDocument.id)?.size || 0) / Math.max(selectedDocument.segments.length, 1)) * 100)
    : 0;
  const needsReviewCount = documents.filter((document) => document.status === 'needs_review' || document.parseStatus === 'needs_review').length;

  useEffect(() => {
    const savedToken = localStorage.getItem('readerToken') || '';
    if (!savedToken) return;
    setToken(savedToken);
    bootstrap(savedToken);
  }, []);

  useEffect(() => {
    if (user && !canManage && activeTab === 'admin') {
      setActiveTab('reader');
    }
  }, [user, canManage, activeTab]);

  useEffect(() => {
    if (!selectedDocument) {
      setEditor(emptyEditor);
      return;
    }
    setEditor({
      id: selectedDocument.id,
      title: selectedDocument.title,
      language: selectedDocument.language,
      category: selectedDocument.category || '未分类',
      description: selectedDocument.description || '',
      status: selectedDocument.status || 'published',
      visibility: selectedDocument.visibility || 'members',
      content: selectedDocument.content,
      translation: selectedDocument.translation || '',
      chunkSize: selectedDocument.chunkSize || 260
    });
    if (!selectedSegmentId && selectedDocument.segments[0]) {
      setSelectedSegmentId(selectedDocument.segments[0].id);
    }
  }, [selectedDocumentId, documents]);

  async function api(path, options = {}, overrideToken = token) {
    const headers = { ...(options.headers || {}) };
    if (overrideToken) headers.Authorization = `Bearer ${overrideToken}`;
    if (options.body && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }
    const response = await fetch(path, {
      ...options,
      headers,
      body: options.body instanceof FormData ? options.body : options.body ? JSON.stringify(options.body) : undefined
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || '请求失败');
    return data;
  }

  async function bootstrap(nextToken) {
    try {
      const currentUser = await api('/api/me', {}, nextToken);
      setUser(currentUser);
      await loadWorkspace(nextToken, currentUser);
    } catch {
      logout();
    }
  }

  async function loadWorkspace(nextToken = token, currentUser = user) {
    const [documentData, checkinData] = await Promise.all([
      api('/api/documents', {}, nextToken),
      api('/api/checkins', {}, nextToken)
    ]);
    setDocuments(documentData.documents);
    setCheckins(checkinData.checkins);
    setSelectedDocumentId((previous) => previous || documentData.documents[0]?.id || '');
    if (currentUser?.role === 'admin') {
      const userData = await api('/api/users', {}, nextToken);
      setUsers(userData.users);
    }
  }

  async function login(event) {
    event.preventDefault();
    setLoginMessage('');
    try {
      const data = await api('/api/login', {
        method: 'POST',
        body: loginForm
      }, '');
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('readerToken', data.token);
      await loadWorkspace(data.token, data.user);
    } catch (error) {
      setLoginMessage(error.message);
    }
  }

  function logout() {
    stopReading();
    localStorage.removeItem('readerToken');
    setToken('');
    setUser(null);
    setDocuments([]);
    setCheckins([]);
    setUsers([]);
    setSelectedDocumentId('');
    setSelectedSegmentId('');
  }

  async function saveDocument(event) {
    event.preventDefault();
    const method = editor.id ? 'PUT' : 'POST';
    const path = editor.id ? `/api/documents/${editor.id}` : '/api/documents';
    const data = await api(path, {
      method,
      body: {
        title: editor.title,
        language: editor.language,
        category: editor.category,
        description: editor.description,
        status: editor.status,
        visibility: editor.visibility,
        content: editor.content,
        translation: editor.translation,
        chunkSize: Number(editor.chunkSize) || 260
      }
    });
    setMessage('内容已保存并重新生成打卡段落');
    setSelectedDocumentId(data.document.id);
    setSelectedSegmentId(data.document.segments[0]?.id || '');
    await loadWorkspace();
  }

  async function deleteDocument() {
    if (!editor.id) return;
    await api(`/api/documents/${editor.id}`, { method: 'DELETE' });
    setMessage('内容已删除');
    setSelectedDocumentId('');
    setSelectedSegmentId('');
    await loadWorkspace();
  }

  async function uploadDocument(event) {
    event.preventDefault();
    const file = event.currentTarget.file.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', uploadTitle);
    const data = await api('/api/uploads', {
      method: 'POST',
      body: formData
    });
    setUploadTitle('');
    event.currentTarget.reset();
    setMessage('上传完成，已生成阅读内容');
    setSelectedDocumentId(data.document.id);
    setSelectedSegmentId(data.document.segments[0]?.id || '');
    await loadWorkspace();
  }

  async function createUser(event) {
    event.preventDefault();
    await api('/api/users', {
      method: 'POST',
      body: newUser
    });
    setNewUser({ username: '', password: '', role: 'reader' });
    const userData = await api('/api/users');
    setUsers(userData.users);
    setMessage('用户已创建');
  }

  async function updateUser(targetUser, patch) {
    const data = await api(`/api/users/${targetUser.id}`, {
      method: 'PUT',
      body: patch
    });
    setUsers((current) => current.map((item) => item.id === data.user.id ? data.user : item));
    setMessage('用户已更新');
  }

  async function deleteUser(targetUser) {
    await api(`/api/users/${targetUser.id}`, { method: 'DELETE' });
    setUsers((current) => current.filter((item) => item.id !== targetUser.id));
    setCheckins((current) => current.filter((item) => item.userId !== targetUser.id));
    setMessage('用户已删除');
  }

  async function toggleCheckin() {
    if (!selectedDocument || !selectedSegment) return;
    const data = await api('/api/checkins', {
      method: 'POST',
      body: {
        documentId: selectedDocument.id,
        segmentId: selectedSegment.id
      }
    });
    setCheckins(data.checkins);
  }

  function toggleReading() {
    if (!selectedSegment) return;
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return;
    if (audioStatus === 'playing') {
      window.speechSynthesis.pause();
      setAudioStatus('paused');
      return;
    }
    if (audioStatus === 'paused') {
      window.speechSynthesis.resume();
      setAudioStatus('playing');
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(selectedSegment.text);
    utterance.lang = selectedDocument?.language === 'en' ? 'en-US' : 'zh-CN';
    utterance.rate = selectedDocument?.language === 'en' ? 0.92 : 0.85;
    utterance.onend = () => setAudioStatus('idle');
    utterance.onerror = () => setAudioStatus('idle');
    window.speechSynthesis.speak(utterance);
    setAudioStatus('playing');
  }

  function stopReading() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setAudioStatus('idle');
  }

  if (!user) {
    return (
      <main className="auth-shell">
        <section className="auth-panel">
          <h1>中英文阅读打卡</h1>
          <p>登录后进入自己的阅读系统。默认管理员：admin / admin123</p>
          <form className="stack-form" onSubmit={login}>
            <label>
              用户名
              <input value={loginForm.username} onChange={(event) => setLoginForm({ ...loginForm, username: event.target.value })} />
            </label>
            <label>
              密码
              <input type="password" value={loginForm.password} onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })} />
            </label>
            <button className="primary-btn" type="submit">进入系统</button>
          </form>
          {loginMessage && <p className="form-message">{loginMessage}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="app-frame">
      <header className="topbar">
        <div>
          <h1>中英文阅读打卡</h1>
          <p>Bilingual Reading Tracker</p>
        </div>
        <div className="topbar-actions">
          <span>{user.username} · {roleLabel[user.role] || user.role}</span>
          <a className="ghost-link" href="/">阅读器</a>
          {canManage && <a className="ghost-link" href="/admin">管理后台</a>}
          <button className="ghost-btn" onClick={logout}>退出</button>
        </div>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <div className="tab-row">
            <button className={activeTab === 'reader' ? 'active' : ''} onClick={() => setActiveTab('reader')}>阅读器</button>
            {canManage && <button className={activeTab === 'admin' ? 'active' : ''} onClick={() => setActiveTab('admin')}>后台</button>}
          </div>
          <button className="ghost-btn full" onClick={() => loadWorkspace()}>刷新</button>
          <div className="document-list">
            {documents.map((document) => {
              const checked = checkedSegmentIds.get(document.id)?.size || 0;
              const percent = Math.round((checked / Math.max(document.segments.length, 1)) * 100);
              return (
                <button
                  key={document.id}
                  className={`document-item ${document.id === selectedDocumentId ? 'active' : ''}`}
                  onClick={() => {
                    stopReading();
                    setSelectedDocumentId(document.id);
                    setSelectedSegmentId(document.segments[0]?.id || '');
                  }}
                >
                  <strong>{document.title}</strong>
                  <small>{sourceTypeLabel[document.sourceType] || '资源'} · {statusLabel[document.status] || '已发布'} · {percent}%</small>
                  <small>{languageLabel[document.language]} · {document.category || '未分类'} · {document.segments.length} 段</small>
                </button>
              );
            })}
          </div>
        </aside>

        {activeTab === 'reader' && (
          <section className="reader-panel">
            <div className="reader-head">
              <div>
                <h2>{selectedDocument?.title || '选择一篇内容'}</h2>
                <p>
                  {selectedDocument
                    ? `${languageLabel[selectedDocument.language]} · ${sourceTypeLabel[selectedDocument.sourceType] || '资源'} · ${statusLabel[selectedDocument.status] || '已发布'} · ${visibilityLabel[selectedDocument.visibility] || '登录可见'} · ${selectedDocument.segments.length} 个打卡段落`
                    : '上传文本、PDF 或图片，或在后台创建内容后开始阅读'}
                </p>
              </div>
              <div className="button-row">
                <button className="ghost-btn" onClick={toggleReading}>{audioStatus === 'playing' ? '暂停' : audioStatus === 'paused' ? '继续' : '朗读'}</button>
                <button className="ghost-btn" onClick={stopReading} disabled={audioStatus === 'idle'}>停止</button>
                <button className="primary-btn" onClick={toggleCheckin}>本段打卡</button>
              </div>
            </div>

            <div className="stats-grid">
              <Stat label="今日打卡" value={todayCount} />
              <Stat label="本文进度" value={`${progress}%`} />
              <Stat label="连续天数" value={streak} />
            </div>

            <div className="segment-list">
              {!selectedDocument && <p className="placeholder">暂无内容</p>}
              {selectedDocument?.segments.map((segment, index) => {
                const checked = checkedSegmentIds.get(selectedDocument.id)?.has(segment.id);
                const active = selectedSegment?.id === segment.id;
                return (
                  <article
                    key={segment.id}
                    className={`segment-card ${active ? 'active' : ''}`}
                    onClick={() => {
                      stopReading();
                      setSelectedSegmentId(segment.id);
                    }}
                  >
                    <div className="segment-meta">
                      <strong>第 {index + 1} 段</strong>
                      <span>{checked ? '已打卡' : '未打卡'}</span>
                    </div>
                    <p>{segment.text}</p>
                    {segment.translation && <blockquote>{segment.translation}</blockquote>}
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {activeTab === 'admin' && canManage && (
          <section className="admin-panel">
            <div className="admin-summary">
              <Stat label="资源总数" value={documents.length} />
              <Stat label="待处理" value={needsReviewCount} />
              <Stat label="打卡记录" value={checkins.length} />
              <Stat label="用户数量" value={canAdmin ? users.length : '-'} />
            </div>
            <div className="admin-grid">
              <section className="panel-card wide">
                <h2>资源编辑</h2>
                <form className="stack-form" onSubmit={saveDocument}>
                  <label>标题<input value={editor.title} onChange={(event) => setEditor({ ...editor, title: event.target.value })} required /></label>
                  <label>语言<select value={editor.language} onChange={(event) => setEditor({ ...editor, language: event.target.value })}>
                    <option value="bilingual">中英文</option>
                    <option value="zh">中文</option>
                    <option value="en">英文</option>
                  </select></label>
                  <div className="form-grid">
                    <label>分类<input value={editor.category} onChange={(event) => setEditor({ ...editor, category: event.target.value })} /></label>
                    <label>状态<select value={editor.status} onChange={(event) => setEditor({ ...editor, status: event.target.value })}>
                      <option value="published">已发布</option>
                      <option value="draft">草稿</option>
                      <option value="needs_review">待处理</option>
                      <option value="archived">已归档</option>
                    </select></label>
                    <label>可见范围<select value={editor.visibility} onChange={(event) => setEditor({ ...editor, visibility: event.target.value })}>
                      <option value="members">登录可见</option>
                      <option value="private">私有</option>
                      <option value="public">公开</option>
                    </select></label>
                    <label>每段字数<input type="number" min="80" max="2000" value={editor.chunkSize} onChange={(event) => setEditor({ ...editor, chunkSize: event.target.value })} /></label>
                  </div>
                  <label>资源说明<input value={editor.description} onChange={(event) => setEditor({ ...editor, description: event.target.value })} placeholder="例如来源、适读年级、课程说明" /></label>
                  <label>原文<textarea rows={11} value={editor.content} onChange={(event) => setEditor({ ...editor, content: event.target.value })} required /></label>
                  <label>译文 / 注释<textarea rows={7} value={editor.translation} onChange={(event) => setEditor({ ...editor, translation: event.target.value })} /></label>
                  <div className="button-row">
                    <button className="primary-btn" type="submit">保存并生成打卡</button>
                    <button className="ghost-btn" type="button" onClick={() => setEditor(emptyEditor)}>新建</button>
                    <button className="danger-btn" type="button" onClick={deleteDocument}>删除</button>
                  </div>
                </form>
              </section>

              <section className="panel-card">
                <h2>上传</h2>
                <form className="stack-form" onSubmit={uploadDocument}>
                  <label>文件<input name="file" type="file" accept=".txt,.md,.pdf,.jpg,.jpeg,.png,.webp,image/*,text/plain,application/pdf" /></label>
                  <label>标题<input value={uploadTitle} onChange={(event) => setUploadTitle(event.target.value)} placeholder="留空使用文件名" /></label>
                  <button className="primary-btn" type="submit">上传并生成</button>
                </form>
                <p className="form-message">TXT/MD 自动读取文本；PDF 和图片会保存文件并生成待处理资源，后续可接 PDF 解析或 OCR。</p>
              </section>

              {canAdmin && <section className="panel-card">
                <h2>用户管理</h2>
                <form className="stack-form" onSubmit={createUser}>
                  <label>用户名<input value={newUser.username} onChange={(event) => setNewUser({ ...newUser, username: event.target.value })} required /></label>
                  <label>密码<input type="password" value={newUser.password} onChange={(event) => setNewUser({ ...newUser, password: event.target.value })} required /></label>
                  <label>角色<select value={newUser.role} onChange={(event) => setNewUser({ ...newUser, role: event.target.value })}>
                    <option value="reader">普通用户</option>
                    <option value="editor">编辑</option>
                    <option value="admin">管理员</option>
                  </select></label>
                  <button className="primary-btn" type="submit">创建用户</button>
                </form>
                <div className="user-list">
                  {users.map((item) => (
                    <UserRow
                      key={item.id}
                      currentUserId={user.id}
                      user={item}
                      onRoleChange={(role) => updateUser(item, { role })}
                      onPasswordReset={(password) => updateUser(item, { password })}
                      onDelete={() => deleteUser(item)}
                    />
                  ))}
                </div>
              </section>}
            </div>
            {message && <p className="toast">{message}</p>}
          </section>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value }) {
  return (
    <div className="stat-item">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function UserRow({ currentUserId, user, onRoleChange, onPasswordReset, onDelete }) {
  const [password, setPassword] = useState('');
  const isCurrentUser = currentUserId === user.id;

  return (
    <div className="user-row manage-user-row">
      <div>
        <strong>{user.username}</strong>
        <small>{isCurrentUser ? '当前登录账号' : '用户账号'}</small>
      </div>
      <select value={user.role} onChange={(event) => onRoleChange(event.target.value)}>
        <option value="reader">普通用户</option>
        <option value="editor">编辑</option>
        <option value="admin">管理员</option>
      </select>
      <input
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="新密码"
      />
      <button
        className="ghost-btn"
        type="button"
        onClick={() => {
          if (!password) return;
          onPasswordReset(password);
          setPassword('');
        }}
      >
        重置密码
      </button>
      <button className="danger-btn" type="button" onClick={onDelete} disabled={isCurrentUser}>
        删除
      </button>
    </div>
  );
}

function todayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function calculateStreak(checkins) {
  const dates = new Set(checkins.map((item) => item.date));
  const cursor = new Date();
  let streak = 0;
  while (dates.has(todayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
