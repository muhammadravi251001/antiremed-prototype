import { useEffect, useState } from 'react'
import { BrowserRouter, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import {
  Activity, Archive, ArrowLeft, ArrowRight, BookOpenCheck, Check, CheckCheck, ChevronDown, CircleHelp, Copy,
  ClipboardList, CloudUpload, CreditCard, Database, FileQuestion, GraduationCap, Image, LayoutDashboard,
  ListChecks, Pencil, Plus, Search, Send, Settings2, ShieldCheck, Sparkles, X,
} from 'lucide-react'
import { api, json } from './api'
import './App.css'

type Master = { id: string; name: string; code?: string; subjectId?: string; subject?: { name: string } }
type Option = { id?: string; label: string; text: string; isCorrect: boolean; explanation: string; sortOrder?: number }
type Media = { id: string; title: string; description?: string; filePath?: string; mediaType: string; sourceType: string; sourceUrl?: string; licenseNote?: string }
type Question = {
  id: string; questionText: string; educationLevelId: string; educationLevel: Master; grade: string
  subjectId: string; subject: Master; topicId: string; topic: Master; difficulty: string; status: string
  mediaNeed: string; mediaExclusionNote?: string; rejectionReason?: string; options: Option[]
  media?: { mediaAsset: Media }[]; updatedAt: string
}
type Package = { id: string; title: string; status: string; packageType: string; grade: string; educationLevelId: string; subjectId: string; subject: Master; questions: { questionId: string }[] }
type Result = { id: string; studentDisplayName: string; score: number; totalQuestions: number; correctCount: number; wrongCount: number; submittedAt: string; package: { title: string } }
type ResultDetail = Result & { answers: { id: string; selectedOptionId?: string | null; isCorrect: boolean; question: { questionText: string; options: Option[] } }[] }
type Distribution = { id: string; recipientType: string; channel: string; recipientLabel: string; status: string; createdAt: string; attempt: { package: { title: string } } }
type Payment = { id: string; serviceName: string; amount: number; referenceCode: string; status: string }
type AuditEvent = { id: string; action: string; entityType: string; entityId: string; actorRole: string; details?: string | null; createdAt: string }
type DashboardSummary = { total: number; draft: number; review: number; validated: number; rejected: number; mediaNeeded: number; packages: number; readyPackages: number; attempts: number; recent: AuditEvent[] }
type IconComponent = typeof LayoutDashboard

const navigation: { label: string; to: string; icon: IconComponent; section: string }[] = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard, section: 'WORKSPACE' },
  { label: 'Buat soal', to: '/generator', icon: Sparkles, section: 'WORKSPACE' },
  { label: 'Bank soal', to: '/questions', icon: FileQuestion, section: 'WORKSPACE' },
  { label: 'Repositori media', to: '/media', icon: Image, section: 'CONTENT' },
  { label: 'Paket soal', to: '/packages', icon: ClipboardList, section: 'CONTENT' },
  { label: 'Hasil & distribusi', to: '/results', icon: ListChecks, section: 'LEARNING' },
  { label: 'Konfirmasi pembayaran', to: '/payments', icon: CreditCard, section: 'SYSTEM' },
  { label: 'Log aktivitas', to: '/logs', icon: Activity, section: 'SYSTEM' },
]

const screenMetadata: Record<string, { screen: string; useCases: string[]; requirements: string[]; phase?: string }> = {
  '/': { screen: 'S-01', useCases: ['UC-04', 'UC-05'], requirements: ['FR-01'] },
  '/generator': { screen: 'S-02', useCases: ['UC-01', 'UC-02', 'UC-03'], requirements: ['FR-02', 'FR-03'] },
  '/review': { screen: 'S-03', useCases: ['UC-04', 'UC-05', 'UC-06', 'UC-07'], requirements: ['FR-09'] },
  '/questions': { screen: 'S-04', useCases: ['UC-03', 'UC-04'], requirements: ['FR-03', 'FR-04'] },
  '/media': { screen: 'S-08', useCases: ['UC-09', 'UC-10', 'UC-11', 'UC-12'], requirements: ['FR-07', 'FR-08'] },
  '/packages': { screen: 'S-09', useCases: ['UC-13'], requirements: ['FR-10', 'FR-11'] },
  '/quiz': { screen: 'S-10', useCases: ['UC-14', 'UC-15'], requirements: ['FR-12', 'FR-13'] },
  '/results': { screen: 'S-14', useCases: ['UC-16', 'UC-17', 'UC-18'], requirements: ['FR-14', 'FR-15'], phase: 'Fase lanjutan · integrasi disimulasikan' },
  '/distribution': { screen: 'S-14', useCases: ['UC-16', 'UC-17', 'UC-18'], requirements: ['FR-14', 'FR-15'], phase: 'Fase lanjutan · integrasi disimulasikan' },
  '/payments': { screen: 'S-21', useCases: ['UC-19', 'UC-20', 'UC-21'], requirements: ['FR-16'], phase: 'Fase lanjutan · integrasi disimulasikan' },
  '/master': { screen: 'S-22', useCases: [], requirements: ['FR-17'] },
  '/settings': { screen: 'S-23', useCases: [], requirements: ['FR-20'] },
  '/logs': { screen: 'S-22', useCases: [], requirements: ['FR-19'] },
}

function App() {
  return <BrowserRouter><Workspace /></BrowserRouter>
}

function Workspace() {
  const [role, setRole] = useState(() => localStorage.getItem('antiremed-role') || 'TEACHER')
  const [reviewCount, setReviewCount] = useState(0)
  const [loggedIn, setLoggedIn] = useState(() => localStorage.getItem('antiremed-demo-session') === 'true')
  const roleLabel = role === 'ADMIN' ? 'Administrator' : role === 'STUDENT' ? 'Siswa' : role === 'PARENT' ? 'Orang tua / pembayar' : 'Pengajar'
  const roleName = role === 'ADMIN' ? 'Admin Demo' : role === 'STUDENT' ? 'Siswa Demo' : role === 'PARENT' ? 'Orang tua Demo' : 'Bu Rina'
  const { pathname } = useLocation()
  const metadata = screenMetadata[pathname] || screenMetadata['/']

  useEffect(() => { localStorage.setItem('antiremed-role', role) }, [role])
  useEffect(() => {
    api<{ review: number }>('/api/dashboard/summary').then((summary) => setReviewCount(summary.review)).catch(() => undefined)
  }, [pathname])

  return <div className="app-shell">
    <header className="reference-header">
      <NavLink className="reference-brand" to="/" aria-label="Antiremed Soal Studio, dashboard">
        <span className="reference-mark">AR</span>
        <span className="reference-brand-copy"><strong>Antiremed Soal Studio</strong><small>Prototipe AKPSI · data contoh</small></span>
      </NavLink>
      {loggedIn && <div className="reference-user">
        <span className="reference-user-name">{roleLabel} · {roleName}</span>
        <label className="role-picker reference-role-picker"><span>Ganti peran</span><select aria-label="Ganti peran" value={role} onChange={(event) => setRole(event.target.value)}><option value="TEACHER">Pengajar · Bu Rina</option><option value="STUDENT">Siswa demo</option><option value="PARENT">Orang tua / pembayar</option><option value="ADMIN">Admin demo</option></select><ChevronDown size={14} /></label>
      </div>}
      <NavLink className="simulation-link" to="/settings"><Activity size={15} /> Panel simulasi</NavLink>
    </header>
    {loggedIn && <nav className="reference-nav" aria-label="Navigasi">
      {navigation.map(({ label, to }) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `reference-tab ${isActive ? 'reference-tab-active' : ''}`}>
        <span>{label}</span>{to === '/questions' && reviewCount > 0 && <span className="reference-count">{reviewCount}</span>}
      </NavLink>)}
    </nav>}
    <main className="main-shell">
      {loggedIn ? <div className="page-container">
        <div className="screen-metadata">
          <span className="screen-code">{metadata.screen}</span>
          {metadata.useCases.map((useCase) => <span className="metadata-chip" key={useCase}>{useCase}</span>)}
          {metadata.requirements.map((requirement) => <span className="metadata-chip" key={requirement}>{requirement}</span>)}
          {metadata.phase && <span className="phase-chip">{metadata.phase}</span>}
        </div>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/questions" element={<QuestionsPage />} />
          <Route path="/generator" element={<GeneratorPage />} />
          <Route path="/review" element={<QuestionsPage reviewOnly />} />
          <Route path="/media" element={<MediaPage />} />
          <Route path="/packages" element={<PackagesPage />} />
          <Route path="/quiz" element={<QuizPage />} />
          <Route path="/results" element={<ResultsPage />} />
          <Route path="/distribution" element={<DistributionPage />} />
          <Route path="/payments" element={<PaymentsPage />} />
          <Route path="/master" element={<MasterPage />} />
          <Route path="/logs" element={<ActivityLogPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <footer className="page-footer"><span>ANTIREMED SOAL STUDIO · PROTOTIPE AKPSI</span><span>Integrasi eksternal disimulasikan · Human review aktif</span></footer>
      </div> : <div className="login-container"><LoginPage role={role} onRoleChange={setRole} onLogin={() => { localStorage.setItem('antiremed-demo-session', 'true'); setLoggedIn(true) }} /></div>}
    </main>
  </div>
}

function LoginPage({ role, onRoleChange, onLogin }: { role: string; onRoleChange: (role: string) => void; onLogin: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('demo1234')
  const [error, setError] = useState('')
  const accountEmail = role === 'STUDENT' ? 'dimas@antiremed.id' : role === 'PARENT' ? 'orangtua@antiremed.id' : 'rina@antiremed.id'

  useEffect(() => { setEmail(accountEmail) }, [accountEmail])

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!email.trim() || !password.trim()) {
      setError('Email dan kata sandi wajib diisi.')
      return
    }
    setError('')
    onLogin()
  }

  const roles = [
    { value: 'TEACHER', title: 'Pengajar', detail: 'Membuat, meninjau, dan memaketkan soal' },
    { value: 'STUDENT', title: 'Siswa', detail: 'Mengerjakan paket di aplikasi kuis' },
    { value: 'PARENT', title: 'Orang tua / pembayar', detail: 'Menerima hasil dan melihat transaksi' },
  ]

  return <section className="login-page">
    <div className="login-intro">
      <span className="login-screen-code">S-00 · DEMO ACCESS</span>
      <h1>Masuk ke Antiremed Soal Studio</h1>
      <p>Prototipe tugas AKPSI. Semua data adalah contoh; integrasi AI, penyimpanan, aplikasi kuis, WhatsApp, dan pembayaran disimulasikan.</p>
    </div>
    <div className="role-cards" role="radiogroup" aria-label="Peran demo">
      {roles.map((item) => <label className={`role-card ${role === item.value ? 'role-card-selected' : ''}`} key={item.value}>
        <input type="radio" name="demo-role" value={item.value} checked={role === item.value} onChange={() => onRoleChange(item.value)} />
        <strong>{item.title}</strong><span>{item.detail}</span>
      </label>)}
    </div>
    <form className="login-form" onSubmit={submit}>
      <div className="login-fields">
        <label className="field">Email<input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        <label className="field">Kata sandi<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
      </div>
      <p className="login-hint">Akun contoh terisi otomatis. Kosongkan field untuk melihat validasi.</p>
      <ErrorLine message={error} />
      <button className="button button-primary login-submit" type="submit">Masuk <ArrowRight size={16} /></button>
    </form>
    <p className="login-disclaimer"><ShieldCheck size={14} /> Autentikasi lokal untuk demonstrasi. Tidak ada akun eksternal yang digunakan.</p>
  </section>
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action && <div className="heading-action">{action}</div>}</div>
}

function Notice({ tone = 'info', children }: { tone?: 'info' | 'warning' | 'success'; children: React.ReactNode }) {
  return <div className={`notice notice-${tone}`}><CircleHelp size={16} /><span>{children}</span></div>
}

function ErrorLine({ message }: { message: string }) {
  return message ? <div className="error-line" role="alert">{message}</div> : null
}

function useMasters() {
  const [levels, setLevels] = useState<Master[]>([])
  const [subjects, setSubjects] = useState<Master[]>([])
  const [topics, setTopics] = useState<Master[]>([])
  const [packageTypes, setPackageTypes] = useState<Master[]>([])
  useEffect(() => {
    Promise.all([api<Master[]>('/api/master/education-levels'), api<Master[]>('/api/master/subjects'), api<Master[]>('/api/master/topics'), api<Master[]>('/api/master/package-types')])
      .then(([nextLevels, nextSubjects, nextTopics, nextPackageTypes]) => { setLevels(nextLevels); setSubjects(nextSubjects); setTopics(nextTopics); setPackageTypes(nextPackageTypes) })
      .catch(() => undefined)
  }, [])
  return { levels, subjects, topics, packageTypes }
}

function Dashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [queue, setQueue] = useState<Question[]>([])
  const [error, setError] = useState('')
  useEffect(() => {
    Promise.all([api<DashboardSummary>('/api/dashboard/summary'), api<Question[]>('/api/questions?status=NEEDS_REVIEW')])
      .then(([nextSummary, nextQueue]) => { setSummary(nextSummary); setQueue(nextQueue.slice(0, 4)) })
      .catch((reason: Error) => setError(reason.message))
  }, [])
  const stats: [string, number, string, string, string][] = summary ? [
    ['Menunggu peninjauan', summary.review, 'perlu diperiksa pengajar', 'stat-amber', '/review'],
    ['Perlu revisi', summary.rejected, 'perlu diperbarui', 'stat-coral', '/questions'],
    ['Kebutuhan media belum terpenuhi', summary.mediaNeeded, 'perlu media aktif', 'stat-blue', '/media'],
    ['Paket siap digunakan', summary.readyPackages, 'tersedia untuk siswa', 'stat-green', '/packages'],
  ] : []
  return <>
    <PageHeading eyebrow={`${new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()} · S-01`} title={`Selamat ${new Date().getHours() < 11 ? 'pagi' : new Date().getHours() < 15 ? 'siang' : 'sore'}, Bu Rina`} description="Ringkasan bank soal hari ini." action={<NavLink className="button button-primary" to="/generator"><Sparkles size={16} /> Buat soal dengan AI</NavLink>} />
    <ErrorLine message={error} />
    <div className="stats-grid">{stats.length ? stats.map(([label, value, note, tone, to]) => <NavLink className={`stat-card stat-link ${tone}`} key={label} to={to}><strong>{value}</strong><span>{label}</span><small>{note}</small></NavLink>) : [1, 2, 3, 4].map((item) => <div className="stat-card skeleton" key={item} />)}</div>
    <div className="dashboard-grid">
      <section className="panel queue-panel">
        <div className="section-heading"><div><span className="eyebrow">WORK QUEUE</span><h2>Antrean peninjauan</h2></div><NavLink to="/review" className="text-link">Lihat semua <ArrowRight size={14} /></NavLink></div>
        {queue.length ? <div className="review-queue">{queue.map((question) => <article className="review-queue-row" key={question.id}><div className="review-queue-copy"><strong>{question.questionText}</strong><span>{question.subject.name} · {question.topic.name}</span></div><div className="review-queue-state"><StatusBadge status={question.status} /><NavLink className="button button-small" to="/review">Tinjau</NavLink></div></article>)}</div> : <div className="empty-state"><strong>Antrean kosong</strong><p>Soal yang perlu ditinjau akan muncul di sini.</p></div>}
      </section>
      <section className="panel activity-panel"><div className="section-heading"><div><span className="eyebrow">SYSTEM LOG</span><h2>Aktivitas sistem terbaru</h2></div><NavLink to="/settings" className="text-link">Buka log <ArrowRight size={14} /></NavLink></div>
        {summary?.recent?.length ? <div className="activity-list">{summary.recent.map((item) => <div className="activity-row" key={item.id}><span className="activity-mark"><Activity size={15} /></span><div><strong>{item.action.replace(/_/g, ' ').toLowerCase()}</strong><small>{item.entityType} · {item.actorRole}</small></div><time>{new Date(item.createdAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</time></div>)}</div> : <div className="empty-state"><span className="empty-icon"><Activity size={20} /></span><strong>Belum ada aktivitas</strong><p>Aktivitas pengajar akan muncul di sini.</p></div>}
      </section>
    </div>
    <div className="dashboard-data-note">{summary?.total ?? '—'} total soal <span>·</span> {summary?.draft ?? '—'} draf <span>·</span> {summary?.validated ?? '—'} tervalidasi <span>·</span> {summary?.packages ?? '—'} paket <span>·</span> {summary?.attempts ?? '—'} pengerjaan</div>
  </>
}

function StatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = { VALIDATED: 'Tervalidasi', NEEDS_REVIEW: 'Review', DRAFT: 'Draft', REJECTED: 'Ditolak', ARCHIVED: 'Arsip', LINKED: 'Tertaut', REQUIRED: 'Perlu media', NOT_REQUIRED: 'Tanpa media', READY: 'Siap', PENDING: 'Pending', PAID: 'Berhasil', FAILED: 'Gagal', SIMULATED: 'Simulasi' }
  return <span className={`status-badge status-${status.toLowerCase()}`}><i />{labels[status] || status}</span>
}

      function QuestionsPage({ reviewOnly = false }: { reviewOnly?: boolean }) {
  const [rows, setRows] = useState<Question[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState(reviewOnly ? 'NEEDS_REVIEW' : '')
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<Question | null>(null)
  const [refresh, setRefresh] = useState(0)
  const { subjects, levels, topics } = useMasters()
  const [subjectId, setSubjectId] = useState('')
  const [levelId, setLevelId] = useState('')
  const [topicId, setTopicId] = useState('')
  const [mediaNeed, setMediaNeed] = useState('')
  const isReview = reviewOnly || status === 'NEEDS_REVIEW'

  useEffect(() => {
    const query = new URLSearchParams()
    if (search) query.set('search', search)
    if (status) query.set('status', status)
    if (subjectId) query.set('subjectId', subjectId)
    if (levelId) query.set('educationLevelId', levelId)
      if (topicId) query.set('topicId', topicId)
    if (mediaNeed) query.set('mediaNeed', mediaNeed)
    api<Question[]>(`/api/questions?${query}`).then(setRows).catch((reason: Error) => setError(reason.message))
  }, [search, status, subjectId, levelId, topicId, mediaNeed, refresh])

  async function review(question: Question, action: 'accept' | 'reject') {
    try {
      if (action === 'accept' && !window.confirm('Terima soal ini setelah ditinjau?')) return
      const body = action === 'reject' ? { reason: window.prompt('Masukkan alasan penolakan:') || '' } : undefined
      if (action === 'reject' && !(body as { reason: string }).reason.trim()) return
      await api(`/api/questions/${question.id}/review/${action}`, json('POST', body))
      setRefresh((value) => value + 1)
      setError('')
    } catch (reason) { setError((reason as Error).message) }
  }

  async function manageQuestion(question: Question, action: 'duplicate' | 'archive') {
    if (action === 'archive' && !window.confirm('Arsipkan soal ini? Soal tidak akan tersedia untuk paket baru.')) return
    try {
      await api(`/api/questions/${question.id}/${action}`, json('POST'))
      setRefresh((value) => value + 1)
      setError('')
    } catch (reason) { setError((reason as Error).message) }
  }

  return <>
    <PageHeading eyebrow={isReview ? 'HUMAN-IN-THE-LOOP' : 'REPOSITORY KONTEN'} title={isReview ? 'Review soal' : 'Bank soal'} description={isReview ? 'Periksa konten dan media sebelum soal dapat digunakan.' : 'Cari, filter, dan kelola seluruh soal dalam satu repositori.'} action={!isReview && <div className="heading-actions"><NavLink className="button" to="/review"><ShieldCheck size={15} /> Review queue</NavLink><NavLink className="button button-primary" to="/generator"><Plus size={16} /> Buat soal</NavLink></div>} />
    <ErrorLine message={error} />
    {isReview && <Notice tone="warning">AI hanya membantu menyusun konten. Soal tidak akan dipublikasikan sebelum diperiksa dan diterima pengajar.</Notice>}
    <section className="panel table-panel">
      <div className="table-toolbar"><div className="search-field"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari pertanyaan..." /></div><div className="filter-group"><select aria-label="Filter status" value={status} onChange={(event) => setStatus(event.target.value)}><option value={reviewOnly ? 'NEEDS_REVIEW' : ''}>Semua status</option><option value="NEEDS_REVIEW">Menunggu review</option><option value="VALIDATED">Tervalidasi</option><option value="DRAFT">Draft</option><option value="REJECTED">Ditolak</option></select><select aria-label="Filter jenjang" value={levelId} onChange={(event) => setLevelId(event.target.value)}><option value="">Semua jenjang</option>{levels.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}</select><select aria-label="Filter mata pelajaran" value={subjectId} onChange={(event) => setSubjectId(event.target.value)}><option value="">Semua mapel</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select><select aria-label="Filter topik" value={topicId} onChange={(event) => setTopicId(event.target.value)}><option value="">Semua topik</option>{topics.filter((topic) => !subjectId || topic.subjectId === subjectId).map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</select><select aria-label="Filter kebutuhan media" value={mediaNeed} onChange={(event) => setMediaNeed(event.target.value)}><option value="">Semua media</option><option value="REQUIRED">Perlu media</option><option value="NOT_REQUIRED">Tanpa media</option><option value="LINKED">Media tertaut</option></select></div></div>
      <div className="table-scroll"><table><thead><tr><th>SOAL</th><th>TAKSONOMI</th><th>STATUS</th><th>MEDIA</th><th>AKSI</th></tr></thead><tbody>
        {rows.map((question) => <tr key={question.id}><td><div className="question-cell"><strong>{question.questionText}</strong><small>{question.options.length} opsi · diperbarui {new Date(question.updatedAt).toLocaleDateString('id-ID')}</small></div></td><td><div className="taxonomy-cell"><strong>{question.subject.name}</strong><small>{question.educationLevel.name} · Kelas {question.grade} · {question.topic.name}</small></div></td><td><StatusBadge status={question.status} /></td><td><StatusBadge status={question.mediaNeed} /></td><td><div className="row-actions">{question.status === 'NEEDS_REVIEW' && <><button className="icon-button approve-button" title="Terima soal" aria-label="Terima soal" onClick={() => review(question, 'accept')}><Check size={16} /></button><button className="icon-button reject-button" title="Tolak soal" aria-label="Tolak soal" onClick={() => review(question, 'reject')}><X size={16} /></button></>}<button className="button button-small" onClick={() => setEditing(question)}>Periksa / ubah</button><button className="icon-button" title="Duplikasi soal" aria-label="Duplikasi soal" onClick={() => manageQuestion(question, 'duplicate')}><Copy size={14} /></button><button className="icon-button reject-button" title="Arsipkan soal" aria-label="Arsipkan soal" onClick={() => manageQuestion(question, 'archive')}><Archive size={14} /></button></div></td></tr>)}
      </tbody></table></div>
      {!rows.length && <div className="empty-state"><span className="empty-icon"><FileQuestion size={20} /></span><strong>{error ? 'Data tidak dapat dimuat' : 'Tidak ada soal yang cocok'}</strong><p>{error || 'Coba ubah kata kunci atau filter.'}</p></div>}
      <div className="table-foot"><span>{rows.length} soal ditampilkan</span><span>Bank soal Antiremed</span></div>
    </section>
    {editing && <QuestionEditor question={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); setRefresh((value) => value + 1) }} />}
  </>
}

function QuestionEditor({ question, onClose, onSaved }: { question: Question; onClose: () => void; onSaved: () => void }) {
  const { levels, subjects, topics } = useMasters()
  const [text, setText] = useState(question.questionText)
  const [options, setOptions] = useState(question.options.map(({ label, text: optionText, isCorrect, explanation }) => ({ label, text: optionText, isCorrect, explanation })))
  const [levelId, setLevelId] = useState(question.educationLevelId)
  const [grade, setGrade] = useState(question.grade)
  const [subjectId, setSubjectId] = useState(question.subjectId)
  const [topicId, setTopicId] = useState(question.topicId)
  const [difficulty, setDifficulty] = useState(question.difficulty)
  const [mediaNeed, setMediaNeed] = useState(question.mediaNeed === 'LINKED' ? 'REQUIRED' : question.mediaNeed)
  const [exclusion, setExclusion] = useState(question.mediaExclusionNote || '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [detecting, setDetecting] = useState(false)

  function updateOption(index: number, key: 'text' | 'explanation', value: string) {
    setOptions((current) => current.map((option, optionIndex) => optionIndex === index ? { ...option, [key]: value } : option))
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (options.filter((option) => option.isCorrect).length !== 1) { setError('Tandai tepat satu jawaban benar.'); return }
    if (mediaNeed === 'NOT_REQUIRED' && !exclusion.trim()) { setError('Tuliskan alasan media tidak diperlukan.'); return }
    setSaving(true)
    try {
      await api(`/api/questions/${question.id}`, json('PATCH', { questionText: text, educationLevelId: levelId, grade, subjectId, topicId, difficulty, mediaNeed, mediaExclusionNote: exclusion, options }))
      onSaved()
    } catch (reason) { setError((reason as Error).message) } finally { setSaving(false) }
  }

  async function detectMedia() {
    setDetecting(true)
    try {
      const result = await api<{ mediaNeed: string; mediaExclusionNote?: string }>(`/api/questions/${question.id}/detect-media`, json('POST'))
      setMediaNeed(result.mediaNeed)
      setExclusion(result.mediaExclusionNote || '')
    } catch (reason) { setError((reason as Error).message) } finally { setDetecting(false) }
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="modal editor-modal" role="dialog" aria-modal="true" aria-labelledby="editor-title"><div className="modal-heading"><div><span className="eyebrow">QUESTION EDITOR</span><h2 id="editor-title">Periksa dan ubah soal</h2></div><button className="icon-button" aria-label="Tutup" onClick={onClose}><X size={18} /></button></div><form onSubmit={save} className="editor-form"><label className="field full-field">Pertanyaan<textarea required minLength={8} value={text} onChange={(event) => setText(event.target.value)} rows={3} /></label><div className="form-grid"><label className="field">Jenjang<select value={levelId} onChange={(event) => setLevelId(event.target.value)}>{levels.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}</select></label><label className="field">Kelas<input required value={grade} onChange={(event) => setGrade(event.target.value)} /></label><label className="field">Mata pelajaran<select value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label><label className="field">Topik<select value={topicId} onChange={(event) => setTopicId(event.target.value)}>{topics.filter((topic) => topic.subjectId === subjectId).map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</select></label><label className="field">Kesulitan<select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}><option value="EASY">Mudah</option><option value="MEDIUM">Sedang</option><option value="HARD">Sulit</option></select></label><label className="field">Media<select value={mediaNeed} onChange={(event) => setMediaNeed(event.target.value)}><option value="REQUIRED">Diperlukan</option><option value="NOT_REQUIRED">Tidak diperlukan</option></select><button type="button" className="button button-small" onClick={detectMedia} disabled={detecting}>{detecting ? 'Mendeteksi...' : 'Deteksi kebutuhan visual'}</button></label></div>{mediaNeed === 'NOT_REQUIRED' && <label className="field full-field">Alasan media tidak diperlukan<input value={exclusion} onChange={(event) => setExclusion(event.target.value)} required /></label>}<div className="options-editor"><div className="options-editor-title"><strong>Pilihan jawaban</strong><span>Pilih satu kunci jawaban</span></div>{options.map((option, index) => <div className="option-edit-row" key={option.label}><label className={`correct-toggle ${option.isCorrect ? 'correct-selected' : ''}`} title="Jadikan jawaban benar"><input type="radio" name="correct" checked={option.isCorrect} onChange={() => setOptions((current) => current.map((item, itemIndex) => ({ ...item, isCorrect: itemIndex === index })))} />{option.label}</label><div className="option-edit-fields"><input aria-label={`Teks pilihan ${option.label}`} value={option.text} onChange={(event) => updateOption(index, 'text', event.target.value)} required /><input aria-label={`Penjelasan pilihan ${option.label}`} placeholder="Penjelasan" value={option.explanation} onChange={(event) => updateOption(index, 'explanation', event.target.value)} required /></div></div>)}</div><ErrorLine message={error} /><div className="modal-actions"><button type="button" className="button" onClick={onClose}>Batal</button><button type="submit" className="button button-primary" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan perubahan'}</button></div></form></div></div>
}

function GeneratorPage() {
  const { levels, subjects, topics } = useMasters()
  const [levelId, setLevelId] = useState('')
  const [grade, setGrade] = useState('10')
  const [subjectId, setSubjectId] = useState('')
  const [topicId, setTopicId] = useState('')
  const [count, setCount] = useState(3)
  const [difficulty, setDifficulty] = useState('MEDIUM')
  const [optionCount, setOptionCount] = useState(4)
  const [media, setMedia] = useState('AUTO')
  const [instruction, setInstruction] = useState('')
  const [results, setResults] = useState<Question[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { if (!levelId && levels.length) setLevelId(levels[2]?.id || levels[0].id) }, [levels, levelId])
  useEffect(() => { if (!subjectId && subjects.length) setSubjectId(subjects[0].id) }, [subjects, subjectId])
  useEffect(() => { const first = topics.find((topic) => topic.subjectId === subjectId); if (first && !topics.some((topic) => topic.id === topicId && topic.subjectId === subjectId)) setTopicId(first.id) }, [topics, subjectId, topicId])

  async function generate(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const result = await api<{ questions: Question[] }>('/api/ai/generate-questions', json('POST', { educationLevelId: levelId, grade, subjectId, topicId, count, difficulty, optionCount, media, additionalInstruction: instruction }))
      setResults(result.questions)
    } catch (reason) { setError((reason as Error).message) } finally { setLoading(false) }
  }

  return <>
    <PageHeading eyebrow="ASSISTED AUTHORING" title="Buat soal dengan AI" description="Susun pilihan ganda terstruktur untuk ditinjau pengajar sebelum digunakan." />
    <Notice>Mode Demo — soal dihasilkan oleh generator simulasi dan otomatis masuk antrean review.</Notice>
    <div className="generator-layout"><section className="panel generator-panel"><form onSubmit={generate}><div className="panel-title"><div><Sparkles size={17} /><strong>Parameter soal</strong></div><span>01 / AUTHORING</span></div><div className="form-grid"><label className="field">Jenjang<select required value={levelId} onChange={(event) => setLevelId(event.target.value)}>{levels.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}</select></label><label className="field">Kelas<input required value={grade} onChange={(event) => setGrade(event.target.value)} /></label><label className="field">Mata pelajaran<select required value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label><label className="field">Topik / bab<select required value={topicId} onChange={(event) => setTopicId(event.target.value)}>{topics.filter((topic) => topic.subjectId === subjectId).map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</select></label><label className="field">Jumlah soal<span className="input-suffix"><input required type="number" min={1} max={10} value={count} onChange={(event) => setCount(Number(event.target.value))} /><small>/ 10</small></span></label><label className="field">Tingkat kesulitan<select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}><option value="EASY">Mudah</option><option value="MEDIUM">Sedang</option><option value="HARD">Sulit</option></select></label></div><div className="field-row"><fieldset className="segmented-field"><legend>Jumlah opsi</legend><div><label><input type="radio" name="option-count" checked={optionCount === 4} onChange={() => setOptionCount(4)} />4 opsi</label><label><input type="radio" name="option-count" checked={optionCount === 5} onChange={() => setOptionCount(5)} />5 opsi</label></div></fieldset><label className="field">Kebutuhan media<select value={media} onChange={(event) => setMedia(event.target.value)}><option value="AUTO">Deteksi otomatis</option><option value="YES">Ya, perlu media</option><option value="NO">Tidak perlu media</option></select></label></div><label className="field">Instruksi tambahan <span className="optional-label">OPSIONAL</span><textarea value={instruction} maxLength={500} onChange={(event) => setInstruction(event.target.value)} placeholder="Contoh: gunakan konteks kehidupan sehari-hari" rows={3} /></label><ErrorLine message={error} /><button className="button button-primary generate-button" type="submit" disabled={loading || !levelId || !subjectId || !topicId}><Sparkles size={16} />{loading ? 'Menyusun soal...' : 'Generate soal'}</button></form></section><aside className="generator-aside"><div className="aside-marker">HITL / 01</div><h3>Draft, bukan jawaban final.</h3><p>Konten dibuat secara deterministik oleh generator lokal. Periksa fakta, kunci, dan penjelasan sebelum menerima.</p><div className="aside-rule" /><div className="aside-check"><Check size={15} /> Jawaban benar tunggal</div><div className="aside-check"><Check size={15} /> Penjelasan per opsi</div><div className="aside-check"><Check size={15} /> Status awal: perlu review</div><div className="aside-bottom"><span>SIMULATED PROVIDER</span><span className="live-dot" /></div></aside></div>
    {results.length > 0 && <section className="generated-results"><div className="section-heading"><div><span className="eyebrow">HASIL GENERATOR · MODE DEMO</span><h2>{results.length} soal masuk antrean review</h2></div><NavLink to="/review" className="text-link">Tinjau sekarang <ArrowRight size={15} /></NavLink></div>{results.map((question, index) => <article className="generated-question" key={question.id}><div className="generated-number">{String(index + 1).padStart(2, '0')}</div><div className="generated-copy"><div className="generated-meta"><StatusBadge status={question.status} /><StatusBadge status={question.mediaNeed} /></div><h3>{question.questionText}</h3><div className="answer-preview">{question.options.map((option) => <span key={option.label} className={option.isCorrect ? 'preview-correct' : ''}>{option.label}. {option.text}</span>)}</div></div><NavLink className="icon-button" to="/review" aria-label="Buka antrean review" title="Buka antrean review"><ArrowRight size={17} /></NavLink></article>)}</section>}
  </>
}

function MediaPage() {
  const [mediaRows, setMediaRows] = useState<Media[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [selectedQuestion, setSelectedQuestion] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [loading, setLoading] = useState(false)
  useEffect(() => { api<Media[]>('/api/media').then(setMediaRows).catch((reason: Error) => setError(reason.message)); api<Question[]>('/api/questions').then(setQuestions).catch(() => undefined) }, [refresh])

  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const data = new FormData()
    data.append('file', file)
    data.append('title', title || file.name)
    data.append('licenseNote', 'Diunggah untuk demo; pastikan hak penggunaan sebelum publikasi.')
    setLoading(true)
    try { await api('/api/media/upload', { method: 'POST', body: data }); setSuccess('Media tersimpan di penyimpanan demo lokal.'); setRefresh((value) => value + 1) }
    catch (reason) { setError((reason as Error).message) } finally { setLoading(false); event.target.value = '' }
  }

  async function generateMedia() {
    if (!title.trim()) { setError('Isi nama visual terlebih dahulu.'); return }
    try { await api('/api/ai/generate-media', json('POST', { title, description })); setSuccess('Aset simulasi ditambahkan ke repositori media.'); setRefresh((value) => value + 1) }
    catch (reason) { setError((reason as Error).message) }
  }

  async function attach(assetId: string) {
    if (!selectedQuestion) { setError('Pilih soal terlebih dahulu.'); return }
    try { await api(`/api/questions/${selectedQuestion}/media`, json('POST', { mediaAssetId: assetId })); setSuccess('Media berhasil dikaitkan dengan soal.'); setRefresh((value) => value + 1) }
    catch (reason) { setError((reason as Error).message) }
  }

  async function detach(assetId: string) {
    if (!selectedQuestion) return
    try {
      await api(`/api/questions/${selectedQuestion}/media/${assetId}`, { method: 'DELETE' })
      setRefresh((value) => value + 1)
      setSuccess('Media dilepas dari soal.')
    } catch (reason) { setError((reason as Error).message) }
  }

  async function updateMedia(asset: Media) {
    const nextTitle = window.prompt('Nama media:', asset.title)
    if (!nextTitle?.trim()) return
    const licenseNote = window.prompt('Catatan lisensi/sumber:', asset.licenseNote || '')
    if (licenseNote === null) return
    try {
      await api(`/api/media/${asset.id}`, json('PATCH', { title: nextTitle, description: asset.description || '', mediaType: asset.mediaType, sourceUrl: asset.sourceUrl || '', licenseNote }))
      setRefresh((value) => value + 1)
      setSuccess('Metadata media diperbarui.')
    } catch (reason) { setError((reason as Error).message) }
  }

  async function archiveMedia(asset: Media) {
    if (!window.confirm(`Arsipkan media "${asset.title}"?`)) return
    try { await api(`/api/media/${asset.id}/archive`, json('POST')); setRefresh((value) => value + 1) }
    catch (reason) { setError((reason as Error).message) }
  }

  return <>
    <PageHeading eyebrow="VISUAL REPOSITORY" title="Media pembelajaran" description="Kelola aset visual dan hubungkan ke soal yang tepat." />
    <Notice>Penyimpanan Demo Lokal — file disimpan pada folder uploads. Periksa metadata sumber dan lisensi sebelum penggunaan di luar demo.</Notice>
    <ErrorLine message={error} />{success && <div className="success-line"><Check size={15} />{success}<button className="icon-button" aria-label="Tutup" onClick={() => setSuccess('')}><X size={14} /></button></div>}
    <div className="media-tools"><section className="panel upload-panel"><div className="section-heading"><div><span className="eyebrow">LOCAL STORAGE</span><h2>Tambah aset</h2></div><CloudUpload size={18} /></div><label className="field">Nama media<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Contoh: Diagram sistem pencernaan" /></label><label className="field">Catatan visual<input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Keterangan singkat" /></label><label className="field">Kaitkan ke soal<select value={selectedQuestion} onChange={(event) => setSelectedQuestion(event.target.value)}><option value="">Pilih soal (opsional)</option>{questions.map((question) => <option value={question.id} key={question.id}>{question.questionText.slice(0, 72)}</option>)}</select></label><div className="media-add-actions"><label className="button upload-button">{loading ? 'Mengunggah...' : 'Unggah gambar'}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={upload} disabled={loading} /></label><button className="button button-primary" onClick={generateMedia}><Sparkles size={15} /> Simulasikan visual</button></div><small className="field-help">PNG, JPG, WEBP · maksimal 5 MB. Provider visual adalah simulasi metadata.</small></section><div className="media-grid-panel"><div className="section-heading"><div><span className="eyebrow">CATALOG</span><h2>Repositori media <span className="count-pill">{mediaRows.length}</span></h2></div><span className="muted-caption">Semua aset demo</span></div><div className="media-grid">{mediaRows.map((asset) => <article className="media-card" key={asset.id}><div className="media-preview">{asset.filePath ? <img src={asset.filePath} alt={asset.title} /> : <div className="media-placeholder"><Image size={25} /><span>{asset.mediaType}</span></div>}<span className="media-kind">{asset.mediaType}</span></div><div className="media-card-copy"><strong>{asset.title}</strong><small>{asset.sourceType === 'AI_GENERATED' ? 'Simulasi lokal' : asset.sourceType === 'UPLOADED' ? 'Unggahan lokal' : 'Repositori internal'}</small><p>{asset.licenseNote || 'Catatan lisensi belum tersedia.'}</p>{selectedQuestion && questions.find((question) => question.id === selectedQuestion)?.media?.some(({ mediaAsset }) => mediaAsset.id === asset.id) ? <button className="button button-small" onClick={() => detach(asset.id)}><X size={13} /> Lepaskan dari soal</button> : <button className="button button-small" onClick={() => attach(asset.id)} disabled={!selectedQuestion}><Plus size={13} /> Kaitkan ke soal</button>}<div className="media-card-actions"><button className="icon-button" aria-label="Ubah metadata media" title="Ubah metadata" onClick={() => updateMedia(asset)}><Pencil size={13} /></button><button className="icon-button reject-button" aria-label="Arsipkan media" title="Arsipkan media" onClick={() => archiveMedia(asset)}><Archive size={13} /></button></div></div></article>)}{!mediaRows.length && <div className="empty-state"><strong>Belum ada media</strong><p>Tambahkan gambar atau buat aset demo.</p></div>}</div></div></div>
  </>
}

function PackagesPage() {
  const { levels, subjects, packageTypes } = useMasters()
  const [packages, setPackages] = useState<Package[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [title, setTitle] = useState('')
  const [levelId, setLevelId] = useState('')
  const [grade, setGrade] = useState('10')
  const [subjectId, setSubjectId] = useState('')
  const [packageType, setPackageType] = useState('PRACTICE')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [editingPackage, setEditingPackage] = useState<Package | null>(null)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  useEffect(() => { api<Package[]>('/api/packages').then(setPackages).catch((reason: Error) => setError(reason.message)); api<Question[]>('/api/questions?status=VALIDATED').then(setQuestions).catch(() => undefined) }, [refresh])
  useEffect(() => { if (!levelId && levels.length) setLevelId(levels[0].id) }, [levels, levelId])
  useEffect(() => { if (!subjectId && subjects.length) setSubjectId(subjects[0].id) }, [subjects, subjectId])

  async function createPackage(event: React.FormEvent) {
    event.preventDefault()
    try {
      const payload = { title, educationLevelId: levelId, grade, subjectId, packageType, questionIds: selectedIds }
      if (editingPackage) await api(`/api/packages/${editingPackage.id}`, json('PATCH', payload))
      else await api('/api/packages', json('POST', payload))
      setTitle(''); setSelectedIds([]); setEditingPackage(null); setRefresh((value) => value + 1); setError('')
    }
    catch (reason) { setError((reason as Error).message) }
  }

  async function markReady(id: string) {
    try { await api(`/api/packages/${id}/ready`, json('POST')); setRefresh((value) => value + 1); setError('') }
    catch (reason) { setError((reason as Error).message) }
  }

  async function archivePackage(item: Package) {
    if (!window.confirm(`Arsipkan paket "${item.title}"?`)) return
    try { await api(`/api/packages/${item.id}/archive`, json('POST')); setRefresh((value) => value + 1) }
    catch (reason) { setError((reason as Error).message) }
  }

  function editPackage(item: Package) {
    setEditingPackage(item)
    setTitle(item.title)
    setLevelId(item.educationLevelId || '')
    setGrade(item.grade)
    setSubjectId(item.subjectId || '')
    setPackageType(item.packageType)
    setSelectedIds(item.questions.map(({ questionId }) => questionId))
  }

  return <>
    <PageHeading eyebrow="ASSESSMENT DESIGN" title="Paket soal" description="Susun paket hanya dari soal yang telah divalidasi pengajar." action={<NavLink className="button button-primary" to="/quiz"><GraduationCap size={15} /> Buka kuis siswa</NavLink>} />
    <ErrorLine message={error} />
    <div className="packages-layout"><section className="panel package-builder"><div className="section-heading"><div><span className="eyebrow">PACKAGE BUILDER</span><h2>{editingPackage ? 'Ubah paket' : 'Buat paket'}</h2></div><ClipboardList size={19} /></div><form onSubmit={createPackage}><label className="field">Nama paket<input required minLength={3} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Contoh: Latihan Bab 1" /></label><div className="form-grid"><label className="field">Jenis paket<select value={packageType} onChange={(event) => setPackageType(event.target.value)}>{packageTypes.map((type) => <option value={type.code} key={type.id}>{type.name}</option>)}</select></label><label className="field">Jenjang<select value={levelId} onChange={(event) => setLevelId(event.target.value)}>{levels.map((level) => <option value={level.id} key={level.id}>{level.name}</option>)}</select></label><label className="field">Kelas<input required value={grade} onChange={(event) => setGrade(event.target.value)} /></label><label className="field">Mata pelajaran<select value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>{subjects.map((subject) => <option value={subject.id} key={subject.id}>{subject.name}</option>)}</select></label></div><div className="question-picker"><div className="picker-heading"><strong>Pilih soal tervalidasi</strong><span>{selectedIds.length} dipilih</span></div>{questions.map((question) => <label className="picker-row" key={question.id}><input type="checkbox" checked={selectedIds.includes(question.id)} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, question.id] : current.filter((id) => id !== question.id))} /><span><strong>{question.questionText}</strong><small>{question.subject.name} · {question.educationLevel.name} · {question.mediaNeed === 'REQUIRED' ? 'perlu media' : 'media tidak diperlukan'}</small></span></label>)}{!questions.length && <div className="subtle-empty">Belum ada soal tervalidasi yang tersedia.</div>}</div><button className="button button-primary full-button" type="submit" disabled={!levelId || !subjectId}><Plus size={15} /> {editingPackage ? 'Simpan perubahan' : 'Simpan draft paket'}</button>{editingPackage && <button type="button" className="button full-button" onClick={() => { setEditingPackage(null); setTitle(''); setSelectedIds([]) }}>Batal ubah paket</button>}</form></section><section className="package-list-panel"><div className="section-heading"><div><span className="eyebrow">YOUR LIBRARY</span><h2>Paket tersimpan <span className="count-pill">{packages.length}</span></h2></div></div>{packages.map((item) => <article className="package-row" key={item.id}><div className="package-cover"><BookOpenCheck size={19} /><span>{item.questions.length.toString().padStart(2, '0')} SOAL</span></div><div className="package-copy"><div className="package-title-line"><strong>{item.title}</strong><StatusBadge status={item.status} /></div><small>{item.subject.name} · Kelas {item.grade} · {item.packageType.replace('_', ' ')}</small><div className="package-row-actions">{item.status !== 'ARCHIVED' && <button className="button button-small" onClick={() => editPackage(item)}><Pencil size={13} /> Ubah</button>}{item.status === 'DRAFT' && <button className="button button-small" onClick={() => markReady(item.id)}><Check size={13} /> Tandai siap</button>}<button className="button button-small" onClick={() => window.open(`/api/packages/${item.id}/export?format=json`, '_blank')}><ArrowRight size={13} /> Ekspor JSON</button>{item.status !== 'ARCHIVED' && <button className="icon-button reject-button" aria-label="Arsipkan paket" title="Arsipkan paket" onClick={() => archivePackage(item)}><Archive size={14} /></button>}</div></div></article>)}{!packages.length && <div className="empty-state"><strong>Belum ada paket</strong><p>Paket yang disimpan muncul di sini.</p></div>}<Notice tone="warning">Paket siap hanya jika seluruh soal tervalidasi dan kebutuhan media terpenuhi atau dikecualikan dengan alasan.</Notice></section></div>
  </>
}

type QuizQuestion = { id: string; questionText: string; options: { id: string; label: string; text: string }[] }
function QuizPage() {
  const [packages, setPackages] = useState<Package[]>([])
  const [packageId, setPackageId] = useState('')
  const [student, setStudent] = useState('Siswa Demo')
  const [attemptId, setAttemptId] = useState('')
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [current, setCurrent] = useState(0)
  const [result, setResult] = useState<{ score: number; correctCount: number; wrongCount: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  useEffect(() => { api<Package[]>('/api/quiz/packages').then((items) => { setPackages(items); if (items.length) setPackageId(items[0].id) }).catch((reason: Error) => setError(reason.message)) }, [])

  async function start() {
    setLoading(true); setError('')
    try {
      const attempt = await api<{ id: string }>('/api/quiz/attempts', json('POST', { packageId, studentDisplayName: student }))
      const items = await api<QuizQuestion[]>(`/api/quiz/attempts/${attempt.id}/questions`)
      setAttemptId(attempt.id); setQuestions(items); setCurrent(0); setAnswers({}); setResult(null)
    } catch (reason) { setError((reason as Error).message) } finally { setLoading(false) }
  }

  async function submit() {
    if (!attemptId || !window.confirm('Kirim jawaban dan lihat hasil?')) return
    setLoading(true)
    try {
      const value = await api<{ score: number; correctCount: number; wrongCount: number }>(`/api/quiz/attempts/${attemptId}/submit`, json('POST', { answers: questions.map((question) => ({ questionId: question.id, selectedOptionId: answers[question.id] || null })) }))
      setResult(value)
    } catch (reason) { setError((reason as Error).message) } finally { setLoading(false) }
  }

  return <>
    <PageHeading eyebrow="STUDENT PREVIEW" title="Kuis siswa" description="Jalankan paket siap pakai dengan identitas siswa demo." />
    <ErrorLine message={error} />
    {!attemptId ? <section className="panel quiz-start"><div className="quiz-emblem"><GraduationCap size={27} /></div><span className="eyebrow">MULAI SESI BELAJAR</span><h2>Pilih paket yang siap</h2><p>Jawaban dan skor disimpan oleh backend lokal.</p><label className="field">Paket<select value={packageId} onChange={(event) => setPackageId(event.target.value)}>{packages.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.questions.length} soal</option>)}</select></label><label className="field">Nama siswa demo<input value={student} maxLength={50} onChange={(event) => setStudent(event.target.value)} /></label><button className="button button-primary full-button" disabled={!packageId || loading} onClick={start}><GraduationCap size={16} />{loading ? 'Menyiapkan kuis...' : 'Mulai kuis'}</button>{!packages.length && <div className="subtle-empty">Belum ada paket siap. Minta pengajar menyiapkan paket soal.</div>}</section> : result ? <section className="panel quiz-result"><div className="result-seal"><Check size={25} /></div><span className="eyebrow">KUIS TERKIRIM</span><h2>Hasil pengerjaan</h2><div className="result-score">{result.score}<small>/ 100</small></div><div className="result-breakdown"><span><Check size={15} />{result.correctCount} benar</span><span><X size={15} />{result.wrongCount} salah</span></div><p>Skor dihitung dan disimpan oleh backend.</p><div className="quiz-result-actions"><button className="button" onClick={() => { setAttemptId(''); setResult(null) }}>Kembali ke paket</button><button className="button button-primary" onClick={() => navigate('/results')}>Lihat hasil belajar <ArrowRight size={15} /></button></div></section> : <section className="panel quiz-runner"><div className="quiz-progress-head"><button className="icon-button" aria-label="Keluar kuis" onClick={() => setAttemptId('')}><ArrowLeft size={17} /></button><div><span className="eyebrow">LATIHAN SISWA · DEMO</span><strong>Soal {current + 1} dari {questions.length}</strong></div><span className="progress-percent">{Math.round(((current + 1) / questions.length) * 100)}%</span></div><div className="progress-track"><span style={{ width: `${((current + 1) / questions.length) * 100}%` }} /></div><div className="quiz-question"><div className="question-index">{String(current + 1).padStart(2, '0')}</div><h2>{questions[current]?.questionText}</h2><div className="quiz-options">{questions[current]?.options.map((option) => <label className={`quiz-option ${answers[questions[current].id] === option.id ? 'quiz-option-selected' : ''}`} key={option.id}><input type="radio" name={`question-${current}`} checked={answers[questions[current].id] === option.id} onChange={() => setAnswers((previous) => ({ ...previous, [questions[current].id]: option.id }))} /><span className="option-label">{option.label}</span><span>{option.text}</span>{answers[questions[current].id] === option.id && <Check size={16} />}</label>)}</div></div><div className="quiz-runner-footer"><span>{Object.keys(answers).length} dari {questions.length} terjawab</span><div>{current > 0 && <button className="button" onClick={() => setCurrent((value) => value - 1)}><ArrowLeft size={15} /> Sebelumnya</button>}{current < questions.length - 1 ? <button className="button button-primary" onClick={() => setCurrent((value) => value + 1)}>Berikutnya <ArrowRight size={15} /></button> : <button className="button button-primary" disabled={loading} onClick={submit}><CheckCheck size={15} /> Kirim jawaban</button>}</div></div></section>}
  </>
}

function ResultsPage() {
  const [results, setResults] = useState<Result[]>([])
  const [selected, setSelected] = useState<ResultDetail | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { api<Result[]>('/api/results').then(setResults).catch((reason: Error) => setError(reason.message)) }, [])
  async function viewResult(id: string) { try { setSelected(await api<ResultDetail>(`/api/results/${id}`)) } catch (reason) { setError((reason as Error).message) } }
  return <>
    <PageHeading eyebrow="LEARNING ANALYTICS" title="Hasil dan distribusi" description="Ringkasan pengerjaan kuis dan capaian siswa demo." action={<NavLink className="button button-primary" to="/distribution"><Send size={15} /> Distribusi hasil</NavLink>} />
    <ErrorLine message={error} />
    <section className="panel table-panel"><div className="table-toolbar"><div><strong>Riwayat pengerjaan</strong><span className="muted-caption"> · {results.length} hasil tersimpan</span></div><span className="muted-caption">Skor dihitung oleh server</span></div><div className="table-scroll"><table><thead><tr><th>SISWA</th><th>PAKET SOAL</th><th>TANGGAL</th><th>SKOR</th><th>RINGKASAN</th><th></th></tr></thead><tbody>{results.map((item) => <tr key={item.id}><td><strong>{item.studentDisplayName}</strong></td><td>{item.package.title}</td><td>{new Date(item.submittedAt).toLocaleDateString('id-ID')}</td><td><span className="score-value">{item.score}<small> / 100</small></span></td><td>{item.correctCount} benar · {item.wrongCount} salah</td><td><button className="button button-small" onClick={() => viewResult(item.id)}>Lihat detail</button></td></tr>)}</tbody></table></div>{!results.length && <div className="empty-state"><strong>Belum ada hasil kuis</strong><p>Hasil pengerjaan siswa akan tercatat di sini.</p></div>}</section>
    {selected && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}><div className="modal result-modal" role="dialog" aria-modal="true"><div className="modal-heading"><div><span className="eyebrow">LEARNING SUMMARY</span><h2>{selected.studentDisplayName}</h2></div><button className="icon-button" aria-label="Tutup" onClick={() => setSelected(null)}><X size={18} /></button></div><div className="result-detail-header"><strong>{selected.package.title}</strong><span className="score-value">{selected.score} / 100</span></div>{selected.answers.map((answer, index) => { const right = answer.question.options.find((option) => option.isCorrect); const chosen = answer.question.options.find((option) => option.id === answer.selectedOptionId); return <div className="result-answer" key={answer.id}><span className={answer.isCorrect ? 'answer-check' : 'answer-cross'}>{answer.isCorrect ? <Check size={14} /> : <X size={14} />}</span><div><small>SOAL {index + 1}</small><p>{answer.question.questionText}</p><span>Jawaban siswa: {chosen?.label || 'Tidak dijawab'} · Kunci: {right?.label}</span></div></div> })}</div></div>}
  </>
}

function DistributionPage() {
  const [results, setResults] = useState<Result[]>([])
  const [history, setHistory] = useState<Distribution[]>([])
  const [attemptId, setAttemptId] = useState('')
  const [recipientType, setRecipientType] = useState('STUDENT')
  const [channel, setChannel] = useState('WHATSAPP')
  const [recipientLabel, setRecipientLabel] = useState('Siswa demo')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [sending, setSending] = useState(false)
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    api<Result[]>('/api/results').then((items) => {
      setResults(items)
      setAttemptId((current) => current && items.some((item) => item.id === current) ? current : items[0]?.id || '')
    }).catch((reason: Error) => setError(reason.message))
    api<Distribution[]>('/api/distributions').then(setHistory).catch((reason: Error) => setError(reason.message))
  }, [refresh])
  const selected = results.find((item) => item.id === attemptId)
  const selectedStudentName = selected?.studentDisplayName || ''
  useEffect(() => {
    if (!selectedStudentName) {
      setRecipientLabel('')
      return
    }
    setRecipientLabel(recipientType === 'PARENT' ? `Orang tua ${selectedStudentName}` : selectedStudentName)
  }, [recipientType, selectedStudentName])

  async function send() {
    if (!attemptId || sending) return
    setSending(true)
    setError('')
    setSuccess('')
    try {
      await api(`/api/results/${attemptId}/distributions`, json('POST', { recipientType, channel, recipientLabel }))
      setSuccess(`Simulasi ${channel === 'EMAIL' ? 'email' : 'WhatsApp'} tercatat. Pesan tidak dikirim.`)
      setRefresh((value) => value + 1)
    } catch (reason) { setError((reason as Error).message) } finally { setSending(false) }
  }
  return <>
    <PageHeading eyebrow="SIMULATED DELIVERY" title="Distribusi hasil" description="Siapkan preview ringkasan belajar untuk siswa atau orang tua." />
    <Notice tone="warning">Simulasi — tidak ada pesan yang dikirim ke alamat email atau nomor telepon nyata.</Notice>
    <ErrorLine message={error} />
    {success && <div className="success-line" role="status"><Check size={15} />{success}</div>}
    <div className="distribution-layout">
      <section className="panel distribution-form">
        <div className="section-heading">
          <div><span className="eyebrow">DELIVERY SETUP</span><h2>Atur penerima</h2></div>
          <span className="step-mark">01 / 02</span>
        </div>
        <label className="field">Hasil kuis
          <select value={attemptId} onChange={(event) => setAttemptId(event.target.value)} disabled={!results.length}>
            {results.map((item) => <option key={item.id} value={item.id}>{item.studentDisplayName} · {item.package.title} · {item.score}/100</option>)}
          </select>
        </label>
        <div className="form-grid">
          <label className="field">Penerima
            <select value={recipientType} onChange={(event) => setRecipientType(event.target.value)}>
              <option value="STUDENT">Siswa</option><option value="PARENT">Orang tua</option>
            </select>
          </label>
          <label className="field">Kanal
            <select value={channel} onChange={(event) => setChannel(event.target.value)}>
              <option value="WHATSAPP">WhatsApp</option><option value="EMAIL">Email</option>
            </select>
          </label>
        </div>
        <label className="field">Label penerima demo
          <input value={recipientLabel} onChange={(event) => setRecipientLabel(event.target.value)} placeholder="Nama penerima demo" />
        </label>
        <div className="recipient-hint"><ShieldCheck size={14} /><span>Nama diisi dari siswa terpilih dan dapat disesuaikan untuk demo.</span></div>
        <button className="button button-primary full-button" onClick={send} disabled={!selected || !recipientLabel.trim() || sending}>
          <Send size={15} />{sending ? 'Mencatat simulasi...' : 'Simulasikan pengiriman'}
        </button>
        {!results.length && <div className="subtle-empty">Belum ada hasil yang dapat dibagikan.</div>}
      </section>
      <section className="panel message-preview">
        <div className="preview-topline">
          <div><span className="eyebrow">PREVIEW PESAN</span><strong>{channel === 'EMAIL' ? 'Email ringkasan' : 'Pesan WhatsApp'}</strong></div>
          <span className="status-badge status-simulated"><i />SIMULASI</span>
        </div>
        <div className="message-card">
          <div className="message-brand"><span className="message-brand-mark"><BookOpenCheck size={16} /></span><strong>Antiremed belajar</strong><span>{channel === 'EMAIL' ? 'email' : 'WhatsApp'}</span></div>
          <div className="message-recipient">UNTUK <strong>{recipientLabel || 'Penerima demo'}</strong></div>
          <p>Halo {selected?.studentDisplayName || 'Siswa Demo'}, berikut ringkasan hasil belajarmu.</p>
          <div className="message-score"><span>Skor pengerjaan</span><strong>{selected?.score ?? '—'}<small>/100</small></strong></div>
          <div className="message-breakdown"><span><strong>{selected?.correctCount ?? '—'}</strong> jawaban benar</span><span><strong>{selected?.wrongCount ?? '—'}</strong> perlu ditinjau</span></div>
          <p>Paket: <strong>{selected?.package.title || 'Pilih hasil kuis'}</strong><br />Terus berlatih dan diskusikan materi yang masih sulit bersama pengajar.</p>
          <small>Pratinjau prototype akademik. Tidak ada pesan yang dikirim.</small>
        </div>
        <div className="message-footnote"><ShieldCheck size={15} /><span>{channel === 'EMAIL' ? 'Email demo' : 'WhatsApp demo'} · tidak terhubung ke alamat nyata</span></div>
      </section>
    </div>
    <section className="panel activity-panel">
      <div className="section-heading"><div><span className="eyebrow">DELIVERY LOG</span><h2>Riwayat simulasi</h2></div><span className="muted-caption">{history.length} aktivitas tersimpan</span></div>
      {history.length ? history.map((item) => <div className="activity-row" key={item.id}><span className="activity-mark"><Send size={14} /></span><div><strong>{item.recipientType === 'PARENT' ? 'Orang tua' : 'Siswa'} · {item.channel}</strong><small>{item.recipientLabel} · {item.attempt.package.title}</small></div><StatusBadge status={item.status} /><time>{new Date(item.createdAt).toLocaleString('id-ID')}</time></div>) : <div className="subtle-empty">Belum ada pengiriman simulasi.</div>}
    </section>
  </>
}

function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [serviceName, setServiceName] = useState('Paket belajar demo')
  const [amount, setAmount] = useState('150000')
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  useEffect(() => { api<Payment[]>('/api/payments').then(setPayments).catch((reason: Error) => setError(reason.message)) }, [refresh])
  async function create(event: React.FormEvent) {
    event.preventDefault()
    try { await api('/api/payments', json('POST', { serviceName, amount: Number(amount) })); setRefresh((value) => value + 1); setError('') }
    catch (reason) { setError((reason as Error).message) }
  }
  async function simulate(id: string, state: string) {
    try { await api(`/api/payments/${id}/simulate-${state}`, json('POST')); setRefresh((value) => value + 1) }
    catch (reason) { setError((reason as Error).message) }
  }
  return <>
    <PageHeading eyebrow="FUTURE SCOPE · ACADEMIC SIMULATION" title="Pembayaran demo" description="Demonstrasikan status transaksi tanpa gateway atau data finansial nyata." />
    <Notice tone="warning">Future Scope — Simulasi Akademik. Tidak ada QRIS sungguhan, payment gateway, atau pembayaran yang diproses.</Notice><ErrorLine message={error} />
    <div className="payment-layout"><section className="panel payment-create"><div className="section-heading"><div><span className="eyebrow">DEMO TRANSACTION</span><h2>Buat transaksi</h2></div><CreditCard size={18} /></div><form onSubmit={create}><label className="field">Nama layanan<input required value={serviceName} onChange={(event) => setServiceName(event.target.value)} /></label><label className="field">Jumlah demo (Rp)<input required type="number" min="0" max="100000000" value={amount} onChange={(event) => setAmount(event.target.value)} /></label><button className="button button-primary full-button"><Plus size={15} /> Buat transaksi pending</button></form><div className="payment-stamp"><ShieldCheck size={15} /><span>Provider: DEMO LOCAL</span></div></section><section className="payment-ledger"><div className="section-heading"><div><span className="eyebrow">TRANSACTION LOG</span><h2>Transaksi tersimpan <span className="count-pill">{payments.length}</span></h2></div></div>{payments.map((item) => <article className="payment-row" key={item.id}><div className="payment-icon"><CreditCard size={17} /></div><div className="payment-copy"><strong>{item.serviceName}</strong><small>{item.referenceCode} · DEMO</small></div><div className="payment-amount">Rp {Number(item.amount).toLocaleString('id-ID')}<StatusBadge status={item.status} /></div><div className="payment-actions"><button className="icon-button approve-button" aria-label="Simulasikan berhasil" title="Simulasikan berhasil" onClick={() => simulate(item.id, 'success')}><Check size={15} /></button><button className="icon-button reject-button" aria-label="Simulasikan gagal" title="Simulasikan gagal" onClick={() => simulate(item.id, 'failure')}><X size={15} /></button><button className="icon-button" aria-label="Set pending" title="Set pending" onClick={() => simulate(item.id, 'pending')}><Activity size={15} /></button></div></article>)}</section></div>
  </>
}

function MasterPage() {
  const { levels, subjects, topics, packageTypes } = useMasters()
  const [kind, setKind] = useState('subjects')
  const [name, setName] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [items, setItems] = useState<Master[]>([])
  useEffect(() => { api<Master[]>(`/api/master/${kind}`).then(setItems).catch((reason: Error) => setError(reason.message)) }, [kind, refresh])
  useEffect(() => { if (!subjectId && subjects.length) setSubjectId(subjects[0].id) }, [subjectId, subjects])
  async function add(event: React.FormEvent) {
    event.preventDefault()
    try { await api(`/api/master/${kind}`, json('POST', { name, ...(kind === 'topics' ? { subjectId } : {}) })); setName(''); setRefresh((value) => value + 1); setError('') }
    catch (reason) { setError((reason as Error).message) }
  }
  async function manageMaster(item: Master, action: 'edit' | 'delete') {
    if (action === 'delete') {
      if (!window.confirm(`Hapus data "${item.name}"? Data yang masih dipakai akan ditolak oleh database.`)) return
      try { await api(`/api/master/${kind}/${item.id}`, { method: 'DELETE' }); setRefresh((value) => value + 1); setError('') }
      catch (reason) { setError((reason as Error).message) }
      return
    }
    const nextName = window.prompt('Ubah nama data:', item.name)
    if (!nextName?.trim()) return
    try { await api(`/api/master/${kind}/${item.id}`, json('PATCH', { name: nextName })); setRefresh((value) => value + 1); setError('') }
    catch (reason) { setError((reason as Error).message) }
  }
  const countMap: Record<string, Master[]> = { 'education-levels': levels, subjects, topics, 'package-types': packageTypes }
  return <>
    <PageHeading eyebrow="TAXONOMY MANAGEMENT" title="Data master" description="Kelola jenjang, mata pelajaran, dan topik untuk klasifikasi soal." />
    <ErrorLine message={error} />
    <div className="master-layout"><section className="panel master-form"><div className="section-heading"><div><span className="eyebrow">NEW RECORD</span><h2>Tambah data</h2></div><Database size={18} /></div><form onSubmit={add}><label className="field">Jenis data<select value={kind} onChange={(event) => setKind(event.target.value)}><option value="education-levels">Jenjang pendidikan</option><option value="subjects">Mata pelajaran</option><option value="topics">Topik</option><option value="package-types">Jenis paket</option></select></label><label className="field">Nama<input required minLength={2} value={name} onChange={(event) => setName(event.target.value)} placeholder="Nama unik" /></label>{kind === 'topics' && <label className="field">Mata pelajaran<select value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>{subjects.map((subject) => <option value={subject.id} key={subject.id}>{subject.name}</option>)}</select></label>}<button className="button button-primary full-button"><Plus size={15} /> Simpan data</button></form></section><section className="panel master-list"><div className="section-heading"><div><span className="eyebrow">REFERENCE DATA</span><h2>Daftar {kind === 'subjects' ? 'mata pelajaran' : kind === 'topics' ? 'topik' : kind === 'package-types' ? 'jenis paket' : 'jenjang'} <span className="count-pill">{items.length}</span></h2></div></div>{items.map((item) => <div className="master-row" key={item.id}><span className="master-row-icon"><Database size={15} /></span><strong>{item.name}</strong>{item.code && <small>{item.code}</small>}{item.subject && <small>{item.subject.name}</small>}<span className="master-active">AKTIF</span><button className="icon-button" aria-label={`Ubah ${item.name}`} title="Ubah" onClick={() => manageMaster(item, 'edit')}><Pencil size={13} /></button><button className="icon-button reject-button" aria-label={`Hapus ${item.name}`} title="Hapus" onClick={() => manageMaster(item, 'delete')}><Archive size={13} /></button></div>)}</section></div><div className="master-summary">{Object.entries(countMap).map(([key, value]) => <span key={key}>{value.length} {key.replace('-', ' ')}</span>)}</div>
  </>
}

function ActivityLogPage() {
  const [records, setRecords] = useState<AuditEvent[]>([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    const query = new URLSearchParams()
    if (search.trim()) query.set('search', search.trim())
    api<AuditEvent[]>(`/api/audit-logs?${query}`).then(setRecords).catch((reason: Error) => setError(reason.message))
  }, [search])

  return <>
    <PageHeading eyebrow="SYSTEM AUDIT · S-22" title="Log aktivitas" description="Riwayat tindakan penting yang tercatat di database demo." action={<NavLink className="button" to="/settings"><Settings2 size={15} /> Panel simulasi</NavLink>} />
    <ErrorLine message={error} />
    <section className="panel table-panel">
      <div className="table-toolbar"><div className="search-field"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari aksi, entitas, atau ID..." aria-label="Cari log aktivitas" /></div><span className="muted-caption">{records.length} aktivitas terbaru · maksimal 100</span></div>
      <div className="table-scroll"><table><thead><tr><th>WAKTU</th><th>AKSI</th><th>ENTITAS</th><th>PELAKU</th><th>DETAIL</th></tr></thead><tbody>
        {records.map((record) => <tr key={record.id}><td>{new Date(record.createdAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</td><td><strong>{record.action.replace(/_/g, ' ')}</strong></td><td>{record.entityType} · {record.entityId.slice(-8)}</td><td>{record.actorRole}</td><td>{record.details || '—'}</td></tr>)}
      </tbody></table></div>
      {!records.length && <div className="empty-state"><span className="empty-icon"><Activity size={20} /></span><strong>{error ? 'Log tidak dapat dimuat' : 'Belum ada aktivitas'}</strong><p>{error || 'Aktivitas sistem akan tercatat di sini.'}</p></div>}
    </section>
  </>
}

function SettingsPage() {
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  async function reset() {
    if (!window.confirm('Reset seluruh data lokal ke seed demo awal? Data prototype saat ini akan diganti.')) return
    try { await api('/api/demo/reset', json('POST')); setMessage('Data demo berhasil dipulihkan.'); setError('') }
    catch (reason) { setError((reason as Error).message) }
  }
  return <>
    <PageHeading eyebrow="SYSTEM LOG · SIMULATION PANEL" title="Log aktivitas dan simulasi" description="Tindakan sistem terakhir, status layanan demo, dan pengelolaan data lokal." action={<NavLink className="button" to="/master"><Database size={15} /> Data master</NavLink>} />
    <ErrorLine message={error} />{message && <div className="success-line"><Check size={15} />{message}<button className="icon-button" aria-label="Tutup" onClick={() => setMessage('')}><X size={14} /></button></div>}
    <div className="settings-grid"><section className="panel settings-panel"><div className="section-heading"><div><span className="eyebrow">RUNTIME</span><h2>Konfigurasi prototype</h2></div><Settings2 size={18} /></div><div className="settings-row"><span>Status demo</span><strong><span className="live-dot" /> Aktif</strong></div><div className="settings-row"><span>Database</span><strong>SQLite lokal · Prisma</strong></div><div className="settings-row"><span>Provider AI soal / media</span><strong>Simulasi deterministik</strong></div><div className="settings-row"><span>Pesan / pembayaran</span><strong>Adapter simulasi lokal</strong></div><div className="settings-row"><span>Frontend / backend</span><strong>React · Express · TypeScript</strong></div><div className="settings-row"><span>Versi prototype</span><strong>1.0.0 · Academic working prototype</strong></div></section><section className="panel reset-panel"><span className="reset-icon"><Archive size={19} /></span><span className="eyebrow">DATA MANAGEMENT</span><h2>Pulihkan data demo</h2><p>Seed awal akan menggantikan data lokal saat ini. File unggahan di folder uploads tidak dihapus.</p><button className="button button-danger" onClick={reset}><Archive size={15} /> Reset data demo</button></section></div>
    <section className="panel architecture-panel"><div className="section-heading"><div><span className="eyebrow">DEPLOYMENT VIEW</span><h2>Arsitektur lokal</h2></div></div><div className="architecture-flow"><span>Browser<br /><small>React + Vite</small></span><ArrowRight size={18} /><span>REST API<br /><small>Express :4000</small></span><ArrowRight size={18} /><span>Prisma ORM<br /><small>SQLite + uploads/</small></span></div><div className="architecture-adapters"><span>Demo AI</span><span>Demo media</span><span>Demo messaging</span><span>Demo payment</span></div></section>
  </>
}

export default App