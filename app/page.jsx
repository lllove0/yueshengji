'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

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

const accessLevelLabel = {
  free: '免费',
  member: '会员',
  paid: '付费'
};

const planLabel = {
  free: '免费版',
  pro: '专业版',
  team: '团队版'
};

const accountStatusLabel = {
  active: '正常',
  suspended: '停用'
};

const reviewStatusLabel = {
  pending: '待校对',
  reviewed: '已校对',
  skipped: '跳过'
};

const adminNav = [
  { id: 'resources', label: '资源管理', href: '/admin/resources' },
  { id: 'review', label: '内容校对', href: '/admin/review' },
  { id: 'users', label: '用户管理', href: '/admin/users', adminOnly: true },
  { id: 'checkins', label: '打卡记录', href: '/admin/checkins' }
];

const emptyEditor = {
  id: '',
  title: '',
  language: 'bilingual',
  category: '未分类',
  description: '',
  status: 'published',
  visibility: 'members',
  accessLevel: 'member',
  priceCents: 0,
  content: '',
  translation: '',
  chunkSize: 260
};

export default function HomePage({ initialTab = 'reader', initialAdminSection = 'resources', lockedMode = 'reader' }) {
  const [token, setToken] = useState('');
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: 'admin', password: 'admin123' });
  const [loginMessage, setLoginMessage] = useState('');
  const [documents, setDocuments] = useState([]);
  const [checkins, setCheckins] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState('');
  const [selectedSegmentId, setSelectedSegmentId] = useState('');
  const [selectedPageId, setSelectedPageId] = useState('');
  const [activeTab, setActiveTab] = useState(lockedMode || initialTab);
  const [activeAdminSection, setActiveAdminSection] = useState(initialAdminSection);
  const [editor, setEditor] = useState(emptyEditor);
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    role: 'reader',
    plan: 'free',
    accountStatus: 'active',
    subscriptionEndsAt: ''
  });
  const [uploadTitle, setUploadTitle] = useState('');
  const [resourceQuery, setResourceQuery] = useState('');
  const [resourceStatus, setResourceStatus] = useState('all');
  const [resourceSourceType, setResourceSourceType] = useState('all');
  const [message, setMessage] = useState('');
  const [audioStatus, setAudioStatus] = useState('idle');
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewType, setPreviewType] = useState('');
  const [previewError, setPreviewError] = useState('');
  const [pageEditor, setPageEditor] = useState({ id: '', text: '', translation: '', reviewStatus: 'pending' });
  const [pdfViewerNonce, setPdfViewerNonce] = useState(0);
  const [userBusyId, setUserBusyId] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);

  const canManage = user && ['admin', 'editor'].includes(user.role);
  const canAdmin = user?.role === 'admin';
  const selectedDocument = documents.find((document) => document.id === selectedDocumentId) || null;
  const selectedPages = normalizeDocumentPages(selectedDocument);
  const selectedPage = selectedPages.find((page) => page.id === selectedPageId) || selectedPages[0] || null;
  const selectedPageIndex = selectedPage ? selectedPages.findIndex((page) => page.id === selectedPage.id) : -1;
  const spreadStartIndex = selectedPageIndex <= 0 ? 0 : selectedPageIndex % 2 === 0 ? selectedPageIndex : selectedPageIndex - 1;
  const spreadStartPage = selectedPages[spreadStartIndex] || selectedPage;
  const pdfPreviewUrl = previewUrl && previewType === 'application/pdf'
    ? `${previewUrl}#page=${spreadStartPage?.pageNumber || 1}&zoom=page-fit&view=FitH&spreadMode=1&reload=${pdfViewerNonce}`
    : '';
  const visibleSegments = selectedPage?.blocks?.length ? selectedPage.blocks : selectedDocument?.segments || [];
  const selectedSegment = visibleSegments.find((segment) => segment.id === selectedSegmentId)
    || visibleSegments[0]
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
  const totalSegmentCount = selectedDocument?.segments?.length || 0;
  const progress = selectedDocument
    ? Math.round(((checkedSegmentIds.get(selectedDocument.id)?.size || 0) / Math.max(totalSegmentCount, 1)) * 100)
    : 0;
  const filteredDocuments = documents.filter((document) => {
    const query = resourceQuery.trim().toLowerCase();
    const searchableText = [
      document.title,
      document.category,
      document.description,
      document.fileName,
      accessLevelLabel[document.accessLevel]
    ].join(' ').toLowerCase();
    const matchesQuery = !query || searchableText.includes(query);
    const matchesStatus = resourceStatus === 'all' || (document.status || 'published') === resourceStatus;
    const matchesSourceType = resourceSourceType === 'all' || (document.sourceType || 'text') === resourceSourceType;
    return matchesQuery && matchesStatus && matchesSourceType;
  });
  const checkinRows = checkins.map((item) => ({
    ...item,
    user: users.find((target) => target.id === item.userId) || (item.userId === user?.id ? user : null),
    document: documents.find((target) => target.id === item.documentId) || null
  }));

  useEffect(() => {
    const savedToken = localStorage.getItem('readerToken') || '';
    if (!savedToken) {
      setAuthReady(true);
      return;
    }
    setToken(savedToken);
    bootstrap(savedToken);
  }, []);

  useEffect(() => {
    if (user && !canManage && activeTab === 'admin' && !lockedMode) {
      setActiveTab('reader');
    }
  }, [user, canManage, activeTab, lockedMode]);

  useEffect(() => {
    if (user && !canAdmin && activeAdminSection === 'users') {
      setActiveAdminSection('resources');
    }
  }, [user, canAdmin, activeAdminSection]);

  useEffect(() => {
    if (!['review', 'resourceForm'].includes(activeAdminSection) || !documents.length) return;
    const documentId = new URLSearchParams(window.location.search).get('document');
    if (documentId && documents.some((document) => document.id === documentId)) {
      setSelectedDocumentId(documentId);
    }
  }, [activeAdminSection, documents]);

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
      accessLevel: selectedDocument.accessLevel || 'member',
      priceCents: selectedDocument.priceCents || 0,
      content: selectedDocument.content,
      translation: selectedDocument.translation || '',
      chunkSize: selectedDocument.chunkSize || 260
    });
    const pages = normalizeDocumentPages(selectedDocument);
    const activePage = pages.find((page) => page.id === selectedPageId) || pages[0];
    if (!selectedPageId && activePage) {
      setSelectedPageId(activePage.id);
    }
    if (!selectedSegmentId && activePage?.blocks?.[0]) {
      setSelectedSegmentId(activePage.blocks[0].id);
    }
  }, [selectedDocumentId, documents]);

  useEffect(() => {
    if (!selectedPage) {
      setPageEditor({ id: '', text: '', translation: '', reviewStatus: 'pending' });
      return;
    }
    setPageEditor({
      id: selectedPage.id,
      text: selectedPage.text || '',
      translation: selectedPage.translation || '',
      reviewStatus: selectedPage.reviewStatus || 'pending'
    });
  }, [selectedPage?.id, selectedPage?.text, selectedPage?.translation, selectedPage?.reviewStatus]);

  useEffect(() => {
    let objectUrl = '';
    let ignore = false;
    setPreviewUrl('');
    setPreviewType('');
    setPreviewError('');

    async function loadPreview() {
      if (!token || !selectedDocument?.filePath || !['pdf', 'image'].includes(selectedDocument.sourceType)) return;
      try {
        const response = await fetch(`/api/documents/${selectedDocument.id}/file`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        if (!response.ok) throw new Error('原文件无法预览');
        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        if (!ignore) {
          setPreviewUrl(objectUrl);
          setPreviewType(blob.type || selectedDocument.sourceType);
        }
      } catch (error) {
        if (!ignore) setPreviewError(error.message);
      }
    }

    loadPreview();
    return () => {
      ignore = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [token, selectedDocument]);

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
    } finally {
      setAuthReady(true);
    }
  }

  async function loadWorkspace(nextToken = token, currentUser = user) {
    const [documentData, checkinData] = await Promise.all([
      api('/api/documents', {}, nextToken),
      api('/api/checkins', {}, nextToken)
    ]);
    setDocuments(documentData.documents);
    setCheckins(checkinData.checkins);
    setSelectedDocumentId((previous) => previous || (activeAdminSection === 'resourceForm' ? '' : documentData.documents[0]?.id || ''));
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
    setAuthReady(true);
    setDocuments([]);
    setCheckins([]);
    setUsers([]);
    setSelectedDocumentId('');
    setSelectedSegmentId('');
    setSelectedPageId('');
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
        accessLevel: editor.accessLevel,
        priceCents: Number(editor.priceCents) || 0,
        content: editor.content,
        pages: editor.id && selectedDocument?.content === editor.content ? selectedDocument.pages : [],
        translation: editor.translation,
        chunkSize: Number(editor.chunkSize) || 260
      }
    });
    setMessage('内容已保存并重新生成打卡段落');
    setSelectedDocumentId(data.document.id);
    setSelectedPageId(data.document.pages?.[0]?.id || 'page-1');
    setSelectedSegmentId(data.document.pages?.[0]?.blocks?.[0]?.id || data.document.segments[0]?.id || '');
    await loadWorkspace();
  }

  async function deleteDocument() {
    if (!editor.id) return;
    await api(`/api/documents/${editor.id}`, { method: 'DELETE' });
    setMessage('内容已删除');
    setSelectedDocumentId('');
    setSelectedSegmentId('');
    setSelectedPageId('');
    await loadWorkspace();
  }

  async function uploadDocument(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const file = form.file.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', uploadTitle);
    const data = await api('/api/uploads', {
      method: 'POST',
      body: formData
    });
    setUploadTitle('');
    form.reset();
    setMessage('上传完成，已生成阅读内容');
    setSelectedDocumentId(data.document.id);
    setSelectedPageId(data.document.pages?.[0]?.id || 'page-1');
    setSelectedSegmentId(data.document.pages?.[0]?.blocks?.[0]?.id || data.document.segments[0]?.id || '');
    await loadWorkspace();
  }

  async function parsePdfDocument() {
    if (!selectedDocument?.id) return;
    const data = await api(`/api/documents/${selectedDocument.id}/parse`, {
      method: 'POST'
    });
    setMessage('PDF 已重新解析并生成打卡段落');
    setSelectedDocumentId(data.document.id);
    setSelectedPageId(data.document.pages?.[0]?.id || 'page-1');
    setSelectedSegmentId(data.document.pages?.[0]?.blocks?.[0]?.id || data.document.segments[0]?.id || '');
    await loadWorkspace();
  }

  async function savePageReview(event) {
    event.preventDefault();
    if (!selectedDocument?.id || !pageEditor.id) return;
    const data = await api(`/api/documents/${selectedDocument.id}/pages/${pageEditor.id}`, {
      method: 'PUT',
      body: {
        text: pageEditor.text,
        translation: pageEditor.translation,
        reviewStatus: pageEditor.reviewStatus
      }
    });
    setMessage('页面已保存并重新生成分段');
    setSelectedDocumentId(data.document.id);
    setSelectedPageId(pageEditor.id);
    const nextPage = data.document.pages?.find((page) => page.id === pageEditor.id);
    setSelectedSegmentId(nextPage?.blocks?.[0]?.id || data.document.segments[0]?.id || '');
    await loadWorkspace();
  }

  async function createUser(event) {
    event.preventDefault();
    setCreatingUser(true);
    setMessage('');
    try {
      await api('/api/users', {
        method: 'POST',
        body: newUser
      });
      setNewUser({
        username: '',
        password: '',
        role: 'reader',
        plan: 'free',
        accountStatus: 'active',
        subscriptionEndsAt: ''
      });
      const userData = await api('/api/users');
      setUsers(userData.users);
      setMessage('用户已创建');
    } catch (error) {
      setMessage(`用户创建失败：${error.message}`);
    } finally {
      setCreatingUser(false);
    }
  }

  async function updateUser(targetUser, patch) {
    setUserBusyId(targetUser.id);
    setMessage('');
    try {
      const data = await api(`/api/users/${targetUser.id}`, {
        method: 'PUT',
        body: patch
      });
      setUsers((current) => current.map((item) => item.id === data.user.id ? data.user : item));
      if (targetUser.id === user?.id) {
        setUser(data.user);
      }
      setMessage('用户已更新');
    } catch (error) {
      setMessage(`用户更新失败：${error.message}`);
    } finally {
      setUserBusyId('');
    }
  }

  async function deleteUser(targetUser) {
    if (!window.confirm(`确定删除用户「${targetUser.username}」吗？相关打卡记录也会一起删除。`)) return;
    setUserBusyId(targetUser.id);
    setMessage('');
    try {
      await api(`/api/users/${targetUser.id}`, { method: 'DELETE' });
      setUsers((current) => current.filter((item) => item.id !== targetUser.id));
      setCheckins((current) => current.filter((item) => item.userId !== targetUser.id));
      setMessage('用户已删除');
    } catch (error) {
      setMessage(`用户删除失败：${error.message}`);
    } finally {
      setUserBusyId('');
    }
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

  if (!authReady) {
    return (
      <main className="auth-shell">
        <section className="auth-panel">
          <h1>阅声记</h1>
          <p>正在恢复登录状态...</p>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="auth-shell">
        <section className="auth-panel">
          <h1>阅声记</h1>
          <p>中英文阅读与语音打卡系统。默认管理员：admin / admin123</p>
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
          <h1>{lockedMode === 'admin' ? '阅声记后台' : '阅声记'}</h1>
          <p>{lockedMode === 'admin' ? '资源、用户与打卡管理' : '中英文阅读与语音打卡系统'}</p>
        </div>
        <div className="topbar-actions">
          <span>{user.username} · {roleLabel[user.role] || user.role}</span>
          <Link className="ghost-link" href="/">前台阅读</Link>
          {canManage && <Link className="ghost-link" href="/admin">后台管理</Link>}
          <button className="ghost-btn" onClick={logout}>退出</button>
        </div>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          {!lockedMode && (
            <div className="tab-row">
              <button className={activeTab === 'reader' ? 'active' : ''} onClick={() => setActiveTab('reader')}>阅读器</button>
              {canManage && <button className={activeTab === 'admin' ? 'active' : ''} onClick={() => setActiveTab('admin')}>后台</button>}
            </div>
          )}
          {activeTab === 'admin' && canManage && (
            <nav className="admin-nav" aria-label="后台管理">
              {adminNav.filter((item) => !item.adminOnly || canAdmin).map((item) => (
                <Link
                  key={item.id}
                  className={activeAdminSection === item.id || (item.id === 'resources' && activeAdminSection === 'resourceForm') ? 'active' : ''}
                  href={item.href}
                  onClick={() => setActiveAdminSection(item.id)}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          )}
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
                    const pages = normalizeDocumentPages(document);
                    setSelectedDocumentId(document.id);
                    setSelectedPageId(pages[0]?.id || '');
                    setSelectedSegmentId(pages[0]?.blocks?.[0]?.id || document.segments[0]?.id || '');
                  }}
                >
                  <strong>{document.title}</strong>
                  <small>{sourceTypeLabel[document.sourceType] || '资源'} · {statusLabel[document.status] || '已发布'} · {accessLevelLabel[document.accessLevel] || '会员'} · {percent}%</small>
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
                    ? `${languageLabel[selectedDocument.language]} · ${sourceTypeLabel[selectedDocument.sourceType] || '资源'} · ${statusLabel[selectedDocument.status] || '已发布'} · ${visibilityLabel[selectedDocument.visibility] || '登录可见'} · ${accessLevelLabel[selectedDocument.accessLevel] || '会员'} · ${formatPrice(selectedDocument.priceCents)} · ${selectedPages.length} 页 · ${totalSegmentCount} 个打卡段落`
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

            {(previewUrl || previewError) && (
              <section className="source-preview">
                <div className="source-preview-head">
                  <strong>原文件预览</strong>
                  <span>{selectedDocument?.fileName || selectedDocument?.title}</span>
                </div>
                {previewUrl && previewType === 'application/pdf' && (
                  <object title="原始 PDF 预览" data={previewUrl} type="application/pdf">
                    <p>当前浏览器无法内嵌预览 PDF，请打开原文件查看。</p>
                  </object>
                )}
                {previewUrl && previewType.startsWith('image/') && (
                  <img src={previewUrl} alt={selectedDocument?.title || '原始图片'} />
                )}
                {previewError && <p className="form-message">{previewError}</p>}
              </section>
            )}

            {selectedPages.length > 1 && (
              <div className="page-strip">
                {selectedPages.map((page) => (
                  <button
                    key={page.id}
                    className={page.id === selectedPage?.id ? 'active' : ''}
                    type="button"
                    onClick={() => {
                      stopReading();
                      setSelectedPageId(page.id);
                      setSelectedSegmentId(page.blocks[0]?.id || '');
                    }}
                  >
                    {page.pageNumber}
                  </button>
                ))}
              </div>
            )}

            {selectedPage && (
              <div className="page-head">
                <strong>{selectedPage.title || `第 ${selectedPage.pageNumber} 页`}</strong>
                <span>{visibleSegments.length} 个文本块</span>
              </div>
            )}

            <div className="segment-list">
              {!selectedDocument && <p className="placeholder">暂无内容</p>}
              {selectedDocument && !visibleSegments.length && <p className="placeholder">当前页暂无文本</p>}
              {visibleSegments.map((segment, index) => {
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
            {activeAdminSection === 'resources' && (
              <div className="resource-admin-stack">
                <section className="panel-card resource-list-panel">
                  <div className="compact-card-head">
                    <h2>资源列表</h2>
                    <div className="head-actions">
                      <span>{filteredDocuments.length} / {documents.length}</span>
                      <Link className="primary-link compact-action" href="/admin/resources/new">上传资源</Link>
                    </div>
                  </div>
                  <div className="resource-filters">
                    <label>搜索<input value={resourceQuery} onChange={(event) => setResourceQuery(event.target.value)} placeholder="标题、分类、文件名" /></label>
                    <label>状态<select value={resourceStatus} onChange={(event) => setResourceStatus(event.target.value)}>
                      <option value="all">全部状态</option>
                      <option value="published">已发布</option>
                      <option value="draft">草稿</option>
                      <option value="needs_review">待处理</option>
                      <option value="archived">已归档</option>
                    </select></label>
                    <label>类型<select value={resourceSourceType} onChange={(event) => setResourceSourceType(event.target.value)}>
                      <option value="all">全部类型</option>
                      <option value="text">文本</option>
                      <option value="pdf">PDF</option>
                      <option value="image">图片</option>
                    </select></label>
                  </div>
                  <div className="resource-table">
                    <div className="resource-table-row resource-table-head">
                      <span>资源</span>
                      <span>类型</span>
                      <span>状态</span>
                      <span>访问</span>
                      <span>分段</span>
                      <span>操作</span>
                    </div>
                    {filteredDocuments.map((document) => (
                      <div
                        className={`resource-table-row ${document.id === selectedDocumentId ? 'active' : ''}`}
                        key={document.id}
                      >
                        <span>
                          <strong>{document.title}</strong>
                          <small>{document.category || '未分类'} · {document.fileName || '手动内容'}</small>
                        </span>
                        <span>{sourceTypeLabel[document.sourceType] || '文本'}</span>
                        <span>{statusLabel[document.status] || '已发布'}</span>
                        <span>{accessLevelLabel[document.accessLevel] || '会员'} · {formatPrice(document.priceCents)}</span>
                        <span>{document.segments?.length || 0}</span>
                        <span className="table-actions">
                          <Link className="ghost-link compact-action" href={`/admin/resources/new?document=${document.id}`}>编辑</Link>
                          <Link className="ghost-link compact-action" href={`/admin/review?document=${document.id}`}>校对</Link>
                        </span>
                      </div>
                    ))}
                    {!filteredDocuments.length && <p className="placeholder compact">没有匹配的资源</p>}
                  </div>
                </section>
              </div>
            )}

            {activeAdminSection === 'resourceForm' && (
              <div className="resource-form-grid">
                <section className="panel-card upload-card">
                  <div className="compact-card-head">
                    <h2>上传资源</h2>
                    <span>TXT / MD / PDF / 图片</span>
                  </div>
                  <form className="upload-form" onSubmit={uploadDocument}>
                    <label>文件<input name="file" type="file" accept=".txt,.md,.pdf,.jpg,.jpeg,.png,.webp,image/*,text/plain,application/pdf" /></label>
                    <label>标题<input value={uploadTitle} onChange={(event) => setUploadTitle(event.target.value)} placeholder="留空使用文件名" /></label>
                    <button className="primary-btn" type="submit">上传并生成</button>
                  </form>
                  <p className="form-message compact">上传后可以在右侧补充分类、发布状态、访问级别和价格。</p>
                </section>

                <section className="panel-card resource-meta-panel">
                  <div className="compact-card-head">
                    <h2>资源信息</h2>
                    <Link className="ghost-link compact-action" href="/admin/resources">返回列表</Link>
                  </div>
                  <form className="stack-form" onSubmit={saveDocument}>
                    <label>标题<input value={editor.title} onChange={(event) => setEditor({ ...editor, title: event.target.value })} required /></label>
                    <div className="form-grid">
                      <label>语言<select value={editor.language} onChange={(event) => setEditor({ ...editor, language: event.target.value })}>
                        <option value="bilingual">中英文</option>
                        <option value="zh">中文</option>
                        <option value="en">英文</option>
                      </select></label>
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
                      <label>访问级别<select value={editor.accessLevel} onChange={(event) => setEditor({ ...editor, accessLevel: event.target.value })}>
                        <option value="free">免费</option>
                        <option value="member">会员</option>
                        <option value="paid">付费</option>
                      </select></label>
                      <label>价格（分）<input type="number" min="0" value={editor.priceCents} onChange={(event) => setEditor({ ...editor, priceCents: event.target.value })} /></label>
                      <label>每段字数<input type="number" min="80" max="2000" value={editor.chunkSize} onChange={(event) => setEditor({ ...editor, chunkSize: event.target.value })} /></label>
                    </div>
                    <label>资源说明<input value={editor.description} onChange={(event) => setEditor({ ...editor, description: event.target.value })} placeholder="例如来源、适读年级、课程说明" /></label>
                    <div className="button-row">
                      <button className="primary-btn" type="submit" disabled={!editor.id}>保存资源信息</button>
                      <Link className="ghost-link compact-action" href={editor.id ? `/admin/review?document=${editor.id}` : '/admin/review'}>进入校对</Link>
                      {selectedDocument?.sourceType === 'pdf' && (
                        <button className="ghost-btn" type="button" onClick={parsePdfDocument}>重新解析 PDF</button>
                      )}
                      <button className="danger-btn" type="button" onClick={deleteDocument} disabled={!editor.id}>删除</button>
                    </div>
                  </form>
                </section>
              </div>
            )}

            {activeAdminSection === 'review' && (
              <div className="review-admin-grid">
                <section className="panel-card review-resource-panel">
                  <div className="compact-card-head">
                    <h2>待校对资源</h2>
                    <span>{filteredDocuments.length} 个资源</span>
                  </div>
                  <div className="resource-filters">
                    <label>搜索<input value={resourceQuery} onChange={(event) => setResourceQuery(event.target.value)} placeholder="标题、分类、文件名" /></label>
                    <label>状态<select value={resourceStatus} onChange={(event) => setResourceStatus(event.target.value)}>
                      <option value="all">全部状态</option>
                      <option value="published">已发布</option>
                      <option value="draft">草稿</option>
                      <option value="needs_review">待处理</option>
                      <option value="archived">已归档</option>
                    </select></label>
                    <label>类型<select value={resourceSourceType} onChange={(event) => setResourceSourceType(event.target.value)}>
                      <option value="all">全部类型</option>
                      <option value="text">文本</option>
                      <option value="pdf">PDF</option>
                      <option value="image">图片</option>
                    </select></label>
                  </div>
                  <div className="resource-list review-resource-list">
                    {filteredDocuments.map((document) => {
                      const pages = normalizeDocumentPages(document);
                      const pendingCount = pages.filter((page) => (page.reviewStatus || 'pending') === 'pending').length;
                      return (
                        <button
                          className={`resource-row ${document.id === selectedDocumentId ? 'active' : ''}`}
                          key={document.id}
                          type="button"
                          onClick={() => {
                            stopReading();
                            setSelectedDocumentId(document.id);
                            setSelectedPageId(pages[0]?.id || '');
                            setSelectedSegmentId(pages[0]?.blocks?.[0]?.id || document.segments[0]?.id || '');
                          }}
                        >
                          <strong>{document.title}</strong>
                          <span>{statusLabel[document.status] || '已发布'} · {pages.length} 页 · 待校对 {pendingCount}</span>
                        </button>
                      );
                    })}
                    {!filteredDocuments.length && <p className="placeholder compact">没有匹配的资源</p>}
                  </div>
                </section>

                <section className="panel-card review-workbench">
                  <h2>校对工作台</h2>
                  {!selectedDocument && <p className="placeholder compact">请选择一个资源开始校对</p>}
                  {selectedDocument && (
                    <>
                      {(previewUrl || previewError) && (
                        <section className="source-preview admin-source-preview">
                          <div className="source-preview-head">
                            <div>
                              <strong>原文件预览</strong>
                              {selectedPage && <span>第 {selectedPage.pageNumber} / {selectedPages.length} 页</span>}
                            </div>
                            <div className="source-preview-actions">
                              {previewUrl && previewType === 'application/pdf' && (
                                <>
                                  <button
                                    className="ghost-btn"
                                    type="button"
                                    disabled={selectedPageIndex <= 0}
                                    onClick={() => {
                                      const previousPage = selectedPages[selectedPageIndex - 1];
                                      if (!previousPage) return;
                                      setSelectedPageId(previousPage.id);
                                      setSelectedSegmentId(previousPage.blocks?.[0]?.id || '');
                                      setPdfViewerNonce((current) => current + 1);
                                    }}
                                  >
                                    上一页
                                  </button>
                                  <button
                                    className="ghost-btn"
                                    type="button"
                                    disabled={selectedPageIndex < 0 || selectedPageIndex >= selectedPages.length - 1}
                                    onClick={() => {
                                      const nextPage = selectedPages[selectedPageIndex + 1];
                                      if (!nextPage) return;
                                      setSelectedPageId(nextPage.id);
                                      setSelectedSegmentId(nextPage.blocks?.[0]?.id || '');
                                      setPdfViewerNonce((current) => current + 1);
                                    }}
                                  >
                                    下一页
                                  </button>
                                </>
                              )}
                              {previewUrl && <a href={previewUrl} target="_blank" rel="noreferrer">打开原文件</a>}
                            </div>
                          </div>
                          {previewUrl && previewType === 'application/pdf' && (
                            <div className="pdf-spread" key={`${selectedDocument.id}-spread-${spreadStartIndex}`}>
                              <div className="pdf-spread-labels">
                                <span>第 {spreadStartPage?.pageNumber || 1} 页</span>
                                {selectedPages[spreadStartIndex + 1] && <span>第 {selectedPages[spreadStartIndex + 1].pageNumber} 页</span>}
                              </div>
                              <iframe
                                key={`${selectedDocument.id}-${spreadStartIndex}-${pdfViewerNonce}`}
                                title="PDF 双页预览"
                                src={pdfPreviewUrl}
                              />
                            </div>
                          )}
                          {previewUrl && previewType.startsWith('image/') && (
                            <div className="page-flip-stage" key={`${selectedDocument.id}-image`}>
                              <img src={previewUrl} alt={selectedDocument?.title || '原始图片'} />
                            </div>
                          )}
                          {previewError && <p className="form-message">{previewError}</p>}
                        </section>
                      )}
                      <section className="page-review-panel">
                        <div className="page-review-head">
                          <h3>页面校对</h3>
                          <span>{selectedPages.length} 页</span>
                        </div>
                        <div className="page-review-layout">
                          <div className="page-review-list">
                            {selectedPages.map((page) => (
                              <button
                                key={page.id}
                                type="button"
                                className={page.id === selectedPage?.id ? 'active' : ''}
                                onClick={() => {
                                  setSelectedPageId(page.id);
                                  setSelectedSegmentId(page.blocks?.[0]?.id || '');
                                  setPdfViewerNonce((current) => current + 1);
                                }}
                              >
                                <strong>第 {page.pageNumber} 页</strong>
                                <span>{reviewStatusLabel[page.reviewStatus] || '待校对'} · {page.blocks?.length || 0} 段</span>
                              </button>
                            ))}
                          </div>
                          <form className="stack-form page-review-form" onSubmit={savePageReview}>
                            <label>校对状态<select value={pageEditor.reviewStatus} onChange={(event) => setPageEditor({ ...pageEditor, reviewStatus: event.target.value })}>
                              <option value="pending">待校对</option>
                              <option value="reviewed">已校对</option>
                              <option value="skipped">跳过</option>
                            </select></label>
                            <label>本页文本<textarea rows={8} value={pageEditor.text} onChange={(event) => setPageEditor({ ...pageEditor, text: event.target.value })} /></label>
                            <label>本页译文 / 注释<textarea rows={5} value={pageEditor.translation} onChange={(event) => setPageEditor({ ...pageEditor, translation: event.target.value })} /></label>
                            <div className="button-row">
                              <button className="primary-btn" type="submit">保存本页并重建分段</button>
                              {selectedDocument?.sourceType === 'pdf' && (
                                <button className="ghost-btn" type="button" onClick={parsePdfDocument}>重新解析 PDF</button>
                              )}
                            </div>
                          </form>
                        </div>
                      </section>
                    </>
                  )}
                </section>
              </div>
            )}

            {activeAdminSection === 'users' && canAdmin && (
              <section className="panel-card">
                <h2>用户管理</h2>
                <form className="stack-form user-create-form" onSubmit={createUser}>
                  <label>用户名<input value={newUser.username} onChange={(event) => setNewUser({ ...newUser, username: event.target.value })} required /></label>
                  <label>密码<input type="password" value={newUser.password} onChange={(event) => setNewUser({ ...newUser, password: event.target.value })} required /></label>
                  <label>角色<select value={newUser.role} onChange={(event) => setNewUser({ ...newUser, role: event.target.value })}>
                    <option value="reader">普通用户</option>
                    <option value="editor">编辑</option>
                    <option value="admin">管理员</option>
                  </select></label>
                  <label>套餐<select value={newUser.plan} onChange={(event) => setNewUser({ ...newUser, plan: event.target.value })}>
                    <option value="free">免费版</option>
                    <option value="pro">专业版</option>
                    <option value="team">团队版</option>
                  </select></label>
                  <label>状态<select value={newUser.accountStatus} onChange={(event) => setNewUser({ ...newUser, accountStatus: event.target.value })}>
                    <option value="active">正常</option>
                    <option value="suspended">停用</option>
                  </select></label>
                  <label>到期日<input type="date" value={newUser.subscriptionEndsAt} onChange={(event) => setNewUser({ ...newUser, subscriptionEndsAt: event.target.value })} /></label>
                  <button className="primary-btn" type="submit" disabled={creatingUser}>
                    {creatingUser ? '创建中...' : '创建用户'}
                  </button>
                </form>
                <div className="user-list">
                  {users.map((item) => (
                    <UserRow
                      key={item.id}
                      currentUserId={user.id}
                      adminCount={users.filter((target) => target.role === 'admin').length}
                      disabled={userBusyId === item.id}
                      user={item}
                      onRoleChange={(role) => updateUser(item, { role })}
                      onPlanChange={(plan) => updateUser(item, { plan })}
                      onStatusChange={(accountStatus) => updateUser(item, { accountStatus })}
                      onSubscriptionChange={(subscriptionEndsAt) => updateUser(item, { subscriptionEndsAt })}
                      onPasswordReset={(password) => updateUser(item, { password })}
                      onDelete={() => deleteUser(item)}
                    />
                  ))}
                </div>
              </section>
            )}

            {activeAdminSection === 'checkins' && (
              <section className="panel-card">
                <h2>打卡记录</h2>
                <div className="data-table">
                  <div className="data-row data-head">
                    <span>用户</span>
                    <span>资源</span>
                    <span>段落</span>
                    <span>日期</span>
                    <span>时间</span>
                  </div>
                  {checkinRows.map((item) => (
                    <div className="data-row" key={item.id}>
                      <span>{item.user?.username || '未知用户'}</span>
                      <span>{item.document?.title || '已删除资源'}</span>
                      <span>{item.segmentId}</span>
                      <span>{item.date}</span>
                      <span>{formatDateTime(item.createdAt)}</span>
                    </div>
                  ))}
                  {!checkinRows.length && <p className="placeholder">暂无打卡记录</p>}
                </div>
              </section>
            )}
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

function UserRow({
  currentUserId,
  adminCount,
  disabled,
  user,
  onRoleChange,
  onPlanChange,
  onStatusChange,
  onSubscriptionChange,
  onPasswordReset,
  onDelete
}) {
  const [password, setPassword] = useState('');
  const isCurrentUser = currentUserId === user.id;
  const isOnlyAdmin = user.role === 'admin' && adminCount <= 1;
  const canChangeRole = !disabled && !isCurrentUser && !isOnlyAdmin;
  const canDelete = !disabled && !isCurrentUser && !isOnlyAdmin;

  return (
    <div className="user-row manage-user-row">
      <div>
        <strong>{user.username}</strong>
        <small>
          {isCurrentUser
            ? '当前登录账号'
            : `${planLabel[user.plan] || '免费版'} · ${accountStatusLabel[user.accountStatus] || '正常'}`}
          {isOnlyAdmin && !isCurrentUser ? ' · 唯一管理员' : ''}
        </small>
      </div>
      <select value={user.role} onChange={(event) => onRoleChange(event.target.value)} disabled={!canChangeRole}>
        <option value="reader">普通用户</option>
        <option value="editor">编辑</option>
        <option value="admin">管理员</option>
      </select>
      <select value={user.plan || 'free'} onChange={(event) => onPlanChange(event.target.value)} disabled={disabled}>
        <option value="free">免费版</option>
        <option value="pro">专业版</option>
        <option value="team">团队版</option>
      </select>
      <select
        value={user.accountStatus || 'active'}
        onChange={(event) => onStatusChange(event.target.value)}
        disabled={disabled || isCurrentUser}
      >
        <option value="active">正常</option>
        <option value="suspended">停用</option>
      </select>
      <input
        type="date"
        value={user.subscriptionEndsAt || ''}
        onChange={(event) => onSubscriptionChange(event.target.value)}
        disabled={disabled}
      />
      <input
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="新密码"
        disabled={disabled}
      />
      <button
        className="ghost-btn"
        type="button"
        disabled={disabled || !password}
        onClick={() => {
          if (!password) return;
          onPasswordReset(password);
          setPassword('');
        }}
      >
        {disabled ? '处理中' : '重置密码'}
      </button>
      <button className="danger-btn" type="button" onClick={onDelete} disabled={!canDelete}>
        删除
      </button>
    </div>
  );
}

function normalizeDocumentPages(document) {
  if (!document) return [];
  if (Array.isArray(document.pages) && document.pages.length) {
    return document.pages.map((page, pageIndex) => ({
      ...page,
      id: page.id || `page-${pageIndex + 1}`,
      pageNumber: page.pageNumber || pageIndex + 1,
      title: page.title || `第 ${page.pageNumber || pageIndex + 1} 页`,
      blocks: Array.isArray(page.blocks) && page.blocks.length
        ? page.blocks
        : (document.segments || []).filter((segment) => segment.pageId === page.id || segment.pageNumber === page.pageNumber)
    }));
  }
  return [
    {
      id: 'page-1',
      pageNumber: 1,
      title: '第 1 页',
      text: document.content || '',
      translation: document.translation || '',
      blocks: document.segments || []
    }
  ];
}

function todayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatPrice(value) {
  const cents = Number(value) || 0;
  if (cents <= 0) return '免费';
  return `¥${(cents / 100).toFixed(2)}`;
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
