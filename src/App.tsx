import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { BrowserRouter, Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { api, json } from './api'
import {
  ActiveAttemptState,
  AttemptItem,
  ConfirmationItem,
  DeliveryItem,
  DL_CLS,
  DL_LABEL,
  IMG,
  initialSeed,
  LEVELS,
  Master,
  MediaCandidate,
  MediaItem,
  mkQ,
  MR_CLS,
  MR_LABEL,
  MS_CLS,
  MS_LABEL,
  now,
  Option,
  PackageItem,
  ParentItem,
  PAY_CLS,
  PAY_LABEL,
  PaymentItem,
  PKG_TYPES,
  PipelineState,
  POOL,
  qrSvg,
  QS_CLS,
  QS_LABEL,
  QuestionItem,
  ResultItem,
  Role,
  rp,
  SimPaySettings,
  SimulationSettings,
  SUBJECTS,
  TOPICS,
  wait,
  checkIssues,
} from './data'
import './App.css'

/* ===================== Route Metadata ===================== */
type RouteMeta = { screen: string; useCases: string[]; fr: string; later?: boolean }

const SCREEN_META: Record<string, RouteMeta> = {
  '/': { screen: 'S-01', useCases: [], fr: '' },
  '/generator': { screen: 'S-02', useCases: ['UC-01'], fr: 'FR-01' },
  '/pipeline': { screen: 'S-03', useCases: ['UC-01', 'UC-02', 'UC-03', 'UC-08'], fr: 'FR-01, FR-02, FR-03, FR-05' },
  '/questions': { screen: 'S-04', useCases: ['UC-03', 'UC-04'], fr: 'FR-03, FR-04' },
  '/review': { screen: 'S-05', useCases: ['UC-04', 'UC-05', 'UC-07', 'UC-02', 'UC-03', 'UC-08'], fr: 'FR-09' },
  '/edit': { screen: 'S-06', useCases: ['UC-06'], fr: 'FR-09' },
  '/media-workbench': { screen: 'S-07', useCases: ['UC-08', 'UC-09', 'UC-10', 'UC-11', 'UC-12'], fr: 'FR-05 s.d. FR-08' },
  '/media': { screen: 'S-08', useCases: ['UC-10', 'UC-12'], fr: 'FR-07' },
  '/packages': { screen: 'S-09', useCases: ['UC-13'], fr: 'FR-10' },
  '/builder': { screen: 'S-10', useCases: ['UC-13'], fr: 'FR-10, FR-04' },
  '/quiz': { screen: 'S-11', useCases: ['UC-14'], fr: 'FR-11' },
  '/quiz-take': { screen: 'S-12', useCases: ['UC-14'], fr: 'FR-11' },
  '/quiz-done': { screen: 'S-13', useCases: ['UC-14', 'UC-15'], fr: 'FR-11' },
  '/results': { screen: 'S-14', useCases: ['UC-16', 'UC-17', 'UC-18'], fr: 'FR-12', later: true },
  '/messages': { screen: 'S-15', useCases: ['UC-17', 'UC-18'], fr: 'FR-12', later: true },
  '/catalog': { screen: 'S-16', useCases: ['UC-19'], fr: 'FR-13', later: true },
  '/checkout': { screen: 'S-17', useCases: ['UC-19'], fr: 'FR-13', later: true },
  '/qris': { screen: 'S-18', useCases: ['UC-19', 'UC-21'], fr: 'FR-13', later: true },
  '/payments': { screen: 'S-21', useCases: ['UC-20', 'UC-21'], fr: 'FR-13', later: true },
  '/logs': { screen: 'S-22', useCases: ['UC-02', 'UC-03', 'UC-08', 'UC-12', 'UC-15', 'UC-16', 'UC-21'], fr: 'NFR-04' },
  '/master': { screen: 'S-22', useCases: [], fr: 'NFR-04' },
}

const ROLE_NAV: Record<Role, [string, [string, string, string?][]][]> = {
  teacher: [
    ['Pembuatan soal', [['/', 'Dashboard'], ['/generator', 'Buat soal'], ['/questions', 'Bank soal', 'review'], ['/media', 'Repositori media']]],
    ['Paket', [['/packages', 'Paket soal']]],
    ['Fase lanjutan', [['/results', 'Hasil & distribusi'], ['/payments', 'Konfirmasi pembayaran']]],
    ['Sistem', [['/logs', 'Log aktivitas'], ['/master', 'Data master']]],
  ],
  student: [
    ['Aplikasi kuis (simulasi)', [['/quiz', 'Kuis saya']]],
  ],
  payer: [
    ['Fase lanjutan', [['/catalog', 'Katalog paket'], ['/messages', 'Pesan diterima']]],
  ],
}

/* ===================== React Main Component ===================== */
export default function App() {
  return (
    <BrowserRouter>
      <Workspace />
    </BrowserRouter>
  )
}

function Workspace() {
  const [role, setRole] = useState<Role | null>(() => (localStorage.getItem('antiremed-role') as Role) || 'teacher')
  const [data, setData] = useState(() => initialSeed())
  const [sim, setSim] = useState<SimulationSettings>({
    ai: 'success',
    explain: 'complete',
    detect: 'auto',
    repo: 'found',
    ext: 'found',
    img: 'success',
    upload: 'success',
    submit: 'success',
    match: 'match',
    stuContact: 'auto',
    parentLink: 'auto',
    channel: 'sent',
    qris: 'ok',
  })
  const [simPay, setSimPay] = useState<SimPaySettings>({ status: 'SUCCESS', variant: 'valid' })
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [toasts, setToasts] = useState<{ id: number; msg: string; bad?: boolean }[]>([])
  const [modal, setModal] = useState<React.ReactNode | null>(null)

  // Current selections
  const [, setSelectedQid] = useState<string>('Q-1004')
  const [selectedPid, setSelectedPid] = useState<string>('P-301')
  const [selectedPayId, setSelectedPayId] = useState<string>('PAY-0901')
  const [activeQuizAttempt, setActiveQuizAttempt] = useState<ActiveAttemptState | null>(null)
  const [activePipeline, setActivePipeline] = useState<PipelineState | null>(null)

  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (role) localStorage.setItem('antiremed-role', role)
    else localStorage.removeItem('antiremed-role')
  }, [role])

  const showToast = useCallback((msg: string, bad = false) => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, msg, bad }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3600)
  }, [])

  const addLog = useCallback((uc: string, msg: string) => {
    setData((prev) => ({
      ...prev,
      log: [{ t: now(), uc, msg }, ...prev.log],
    }))
  }, [])

  // Count questions waiting review
  const waitingReviewCount = useMemo(() => {
    return data.questions.filter((q) => q.status === 'InReview' || q.status === 'RevisionRequired').length
  }, [data.questions])

  // Get current metadata
  const metaKey = location.pathname.startsWith('/questions/') && location.pathname.endsWith('/edit') ? '/edit'
    : location.pathname.startsWith('/questions/') && location.pathname.endsWith('/media') ? '/media-workbench'
    : location.pathname.startsWith('/questions/') ? '/review'
    : location.pathname.startsWith('/packages/') ? '/builder'
    : location.pathname.startsWith('/checkout') ? '/checkout'
    : location.pathname.startsWith('/qris') ? '/qris'
    : location.pathname.startsWith('/quiz-take') ? '/quiz-take'
    : location.pathname.startsWith('/quiz-done') ? '/quiz-done'
    : location.pathname.startsWith('/pipeline') ? '/pipeline'
    : location.pathname

  const meta = SCREEN_META[metaKey] || SCREEN_META['/']

  function handleLogout() {
    setRole(null)
    navigate('/login')
  }

  function handleResetDemo() {
    setData(initialSeed())
    api('/api/demo/reset', json('POST')).catch(() => undefined)
    showToast('Data demo diatur ulang')
    setDrawerOpen(false)
  }

  function handleProviderSend() {
    const activePay = data.payments.find((p) => p.id === selectedPayId) || data.payments.find((p) => p.status === 'Created' || p.status === 'Pending')
    if (!activePay) {
      showToast('Tidak ada transaksi aktif. Buat pembelian dulu sebagai Orang tua.', true)
      return
    }

    const cfId = `CF-${String(data.seq.cf).padStart(2, '0')}`
    const nextSeq = { ...data.seq, cf: data.seq.cf + 1 }
    let state = 'Notified'
    let note = ''

    if (simPay.variant === 'amount') {
      state = 'VerificationFailed'
      note = 'Jumlah tidak sama dengan transaksi; anomali dicatat, status tidak diubah'
    } else if (simPay.variant === 'mismatch') {
      state = 'OnHold'
      note = 'Tidak cocok dengan pengguna/paket; akses tidak diaktifkan, perlu peninjauan manual'
    } else if (['Paid', 'Failed', 'Cancelled'].includes(activePay.status)) {
      state = 'Ignored'
      note = 'Transaksi sudah final; notifikasi duplikat/terlambat diabaikan'
    } else {
      if (simPay.status === 'SUCCESS') {
        activePay.status = 'Paid'
        const accId = `A-0${nextSeq.acc++}`
        data.access.push({ id: accId, studentId: activePay.studentId, packageId: activePay.packageId, status: 'Active', via: activePay.id })
        state = 'Notified'
        note = 'Paid disimpan, akses paket aktif, pengguna diberi tahu'
      } else if (simPay.status === 'FAILED') {
        activePay.status = 'Failed'
        activePay.reason = 'failed'
        state = 'Notified'
        note = 'Failed disimpan, pengguna diberi tahu'
      } else if (simPay.status === 'PENDING') {
        activePay.status = 'Pending'
        state = 'PendingRecheck'
        note = 'Pending disimpan, cek ulang dijadwalkan'
      }
    }

    const cf: ConfirmationItem = {
      id: cfId,
      paymentId: activePay.id,
      source: 'notifikasi',
      provider: simPay.status,
      state,
      at: now(),
      note,
    }

    setData((prev) => ({
      ...prev,
      confirmations: [cf, ...prev.confirmations],
      seq: nextSeq,
    }))
    addLog('UC-21', `${cf.id} untuk ${activePay.id}: ${cf.state}. ${cf.note}`)
    showToast(`UC-21: ${state}`)
  }

  const roleLabel = role === 'teacher' ? 'Pengajar · Bu Rina' : role === 'student' ? 'Siswa · Dimas Pratama' : 'Orang tua/pembayar · Ibu Sari'

  return (
    <div>
      <header className="top">
        <Link className="brand" to="/">
          <div className="mk">AR</div>
          <div>
            Antiremed Soal Studio
            <small>Prototipe AKPSI · data contoh</small>
          </div>
        </Link>
        <div className="sp" />
        {role && (
          <div className="rolepill">
            <span>{roleLabel}</span>
            <button className="btn sm ghost" onClick={handleLogout} type="button">
              Ganti peran
            </button>
          </div>
        )}
        <button className="btn sm" onClick={() => setDrawerOpen((o) => !o)} type="button" aria-controls="drawer">
          Panel simulasi
        </button>
      </header>

      <div className={`shell ${!role ? 'single-col' : ''}`}>
        {role && (
          <nav className="side" aria-label="Navigasi">
            {ROLE_NAV[role].map(([grp, items]) => (
              <React.Fragment key={grp}>
                <div className="grp">{grp}</div>
                {items.map(([to, label, badge]) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === '/'}
                    className={({ isActive }) => `nav ${isActive ? 'on' : ''}`}
                  >
                    <span>{label}</span>
                    {badge === 'review' && waitingReviewCount > 0 && <span className="cnt">{waitingReviewCount}</span>}
                  </NavLink>
                ))}
              </React.Fragment>
            ))}
          </nav>
        )}

        <main>
          <div className="wrap">
            {role && (
              <div className="strip">
                <span className="sid">{meta.screen}</span>
                {meta.useCases.map((uc) => (
                  <span className="tag" key={uc}>
                    {uc}
                  </span>
                ))}
                {meta.fr && <span className="tag">{meta.fr}</span>}
                {meta.later && <span className="tag later">Fase lanjutan · integrasi disimulasikan</span>}
              </div>
            )}

            <Routes>
              {/* S-00 Login */}
              <Route path="/login" element={<LoginPage onSelectRole={(r) => { setRole(r); navigate(r === 'teacher' ? '/' : r === 'student' ? '/quiz' : '/catalog') }} />} />

              {/* S-01 Dashboard */}
              <Route
                path="/"
                element={
                  !role ? (
                    <Navigate to="/login" replace />
                  ) : role === 'student' ? (
                    <Navigate to="/quiz" replace />
                  ) : role === 'payer' ? (
                    <Navigate to="/catalog" replace />
                  ) : (
                    <DashboardPage data={data} onReviewQ={(qid) => { setSelectedQid(qid); navigate(`/questions/${qid}`) }} />
                  )
                }
              />

              {/* S-02 & S-03 Generator & Pipeline */}
              <Route
                path="/generator"
                element={
                  <GeneratorPage
                    onStartPipeline={(pipelineData) => {
                      setActivePipeline(pipelineData)
                      navigate('/pipeline')
                    }}
                  />
                }
              />
              <Route
                path="/pipeline"
                element={
                  <PipelinePage
                    pipeline={activePipeline}
                    data={data}
                    setData={setData}
                    sim={sim}
                    addLog={addLog}
                    showToast={showToast}
                    onReviewQ={(qid) => { setSelectedQid(qid); navigate(`/questions/${qid}`) }}
                  />
                }
              />

              {/* S-04 Bank Soal */}
              <Route path="/questions" element={<BankPage data={data} onReviewQ={(qid) => { setSelectedQid(qid); navigate(`/questions/${qid}`) }} />} />

              {/* S-05 Tinjau Soal */}
              <Route
                path="/questions/:id"
                element={
                  <ReviewPage
                    data={data}
                    setData={setData}
                    addLog={addLog}
                    showToast={showToast}
                    setModal={setModal}
                    onEditQ={(qid) => { setSelectedQid(qid); navigate(`/questions/${qid}/edit`) }}
                    onMediaQ={(qid) => { setSelectedQid(qid); navigate(`/questions/${qid}/media`) }}
                  />
                }
              />

              {/* S-06 Ubah Soal */}
              <Route path="/questions/:id/edit" element={<EditPage data={data} setData={setData} addLog={addLog} showToast={showToast} />} />

              {/* S-07 Media Soal Workbench */}
              <Route path="/questions/:id/media" element={<MediaWorkbenchPage data={data} setData={setData} sim={sim} addLog={addLog} showToast={showToast} />} />

              {/* S-08 Repositori Media */}
              <Route path="/media" element={<RepoPage data={data} setData={setData} addLog={addLog} showToast={showToast} />} />

              {/* S-09 Paket Soal */}
              <Route path="/packages" element={<PackagesPage data={data} setData={setData} addLog={addLog} />} />

              {/* S-10 Susun Paket */}
              <Route path="/packages/:id" element={<PackageBuilderPage data={data} setData={setData} addLog={addLog} showToast={showToast} />} />

              {/* S-11 Kuis Saya */}
              <Route
                path="/quiz"
                element={
                  <QuizListPage
                    data={data}
                    onStartQuiz={(pid) => {
                      setActiveQuizAttempt({ pid, i: 0, ans: {}, err: false })
                      addLog('UC-14', `Aplikasi kuis meminta paket ${pid}`)
                      navigate('/quiz-take')
                    }}
                  />
                }
              />

              {/* S-12 Kerjakan Kuis */}
              <Route
                path="/quiz-take"
                element={
                  <QuizTakerPage
                    attempt={activeQuizAttempt}
                    setAttempt={setActiveQuizAttempt}
                    data={data}
                    setData={setData}
                    sim={sim}
                    addLog={addLog}
                    onDone={() => navigate('/quiz-done')}
                  />
                }
              />

              {/* S-13 Hasil Kuis */}
              <Route path="/quiz-done" element={<QuizDonePage data={data} />} />

              {/* S-14 Hasil & Distribusi */}
              <Route path="/results" element={<ResultsPage data={data} setData={setData} sim={sim} addLog={addLog} showToast={showToast} />} />

              {/* S-15 Pesan Diterima */}
              <Route path="/messages" element={<MessagesPage data={data} />} />

              {/* S-16 Katalog Paket */}
              <Route
                path="/catalog"
                element={
                  <CatalogPage
                    data={data}
                    onBuy={(pid) => {
                      setSelectedPid(pid)
                      navigate('/checkout')
                    }}
                    onViewPay={(payId) => {
                      setSelectedPayId(payId)
                      navigate('/qris')
                    }}
                  />
                }
              />

              {/* S-17 Checkout */}
              <Route
                path="/checkout"
                element={
                  <CheckoutPage
                    pid={selectedPid}
                    data={data}
                    setData={setData}
                    sim={sim}
                    addLog={addLog}
                    onCreated={(payId) => {
                      setSelectedPayId(payId)
                      navigate('/qris')
                    }}
                  />
                }
              />

              {/* S-18 Pembayaran QRIS */}
              <Route
                path="/qris"
                element={
                  <QrisPage
                    payId={selectedPayId}
                    data={data}
                    setData={setData}
                    addLog={addLog}
                    showToast={showToast}
                    setModal={setModal}
                    onRetryBuy={(pid) => {
                      setSelectedPid(pid)
                      navigate('/checkout')
                    }}
                  />
                }
              />

              {/* S-21 Konfirmasi Pembayaran */}
              <Route path="/payments" element={<ConfirmationPage data={data} />} />

              {/* S-22 Log Aktivitas Sistem */}
              <Route path="/logs" element={<LogPage data={data} />} />

              {/* Master Page */}
              <Route path="/master" element={<MasterPage />} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>
      </div>

      {/* Drawer Panel Simulasi */}
      <aside className="drawer" id="drawer" hidden={!drawerOpen}>
        <h2>
          Panel simulasi{' '}
          <button className="btn sm" onClick={() => setDrawerOpen(false)} type="button">
            Tutup
          </button>
        </h2>
        <p className="small muted">Atur respons layanan eksternal untuk mendemonstrasikan alur alternatif. Tidak ada layanan nyata yang dipanggil.</p>

        <div className="sim">
          <label htmlFor="sim-ai">Generative AI (UC-01)</label>
          <select id="sim-ai" value={sim.ai} onChange={(e) => setSim({ ...sim, ai: e.target.value as SimulationSettings['ai'] })}>
            <option value="success">Berhasil</option>
            <option value="fail">Gagal / timeout</option>
          </select>

          <label htmlFor="sim-explain">Penjelasan (UC-02)</label>
          <select id="sim-explain" value={sim.explain} onChange={(e) => setSim({ ...sim, explain: e.target.value as SimulationSettings['explain'] })}>
            <option value="complete">Lengkap</option>
            <option value="incomplete">Tidak lengkap</option>
          </select>

          <label htmlFor="sim-detect">Deteksi media (UC-08)</label>
          <select id="sim-detect" value={sim.detect} onChange={(e) => setSim({ ...sim, detect: e.target.value as SimulationSettings['detect'] })}>
            <option value="auto">Sesuai isi soal</option>
            <option value="Required">Selalu butuh</option>
            <option value="NeedsCheck">Tidak meyakinkan</option>
            <option value="NotRequired">Tidak perlu</option>
          </select>

          <label htmlFor="sim-repo">Repositori (UC-10)</label>
          <select id="sim-repo" value={sim.repo} onChange={(e) => setSim({ ...sim, repo: e.target.value as SimulationSettings['repo'] })}>
            <option value="found">Ada kandidat</option>
            <option value="none">Tidak ada</option>
          </select>

          <label htmlFor="sim-ext">Sumber media (UC-09)</label>
          <select id="sim-ext" value={sim.ext} onChange={(e) => setSim({ ...sim, ext: e.target.value as SimulationSettings['ext'] })}>
            <option value="found">Ada kandidat</option>
            <option value="none">Tidak ada</option>
            <option value="down">Sumber tidak tersedia</option>
          </select>

          <label htmlFor="sim-img">AI Image Gen (UC-11)</label>
          <select id="sim-img" value={sim.img} onChange={(e) => setSim({ ...sim, img: e.target.value as SimulationSettings['img'] })}>
            <option value="success">Berhasil</option>
            <option value="fail">Gagal</option>
          </select>

          <label htmlFor="sim-upload">Penyimpanan (UC-12)</label>
          <select id="sim-upload" value={sim.upload} onChange={(e) => setSim({ ...sim, upload: e.target.value as SimulationSettings['upload'] })}>
            <option value="success">Berhasil</option>
            <option value="fail">Gagal 3x</option>
          </select>

          <label htmlFor="sim-submit">Kirim jawaban (UC-14)</label>
          <select id="sim-submit" value={sim.submit} onChange={(e) => setSim({ ...sim, submit: e.target.value as SimulationSettings['submit'] })}>
            <option value="success">Berhasil</option>
            <option value="fail">Koneksi gagal</option>
          </select>

          <label htmlFor="sim-match">Pencocokan hasil (UC-15)</label>
          <select id="sim-match" value={sim.match} onChange={(e) => setSim({ ...sim, match: e.target.value as SimulationSettings['match'] })}>
            <option value="match">Cocok</option>
            <option value="mismatch">Tidak cocok</option>
          </select>

          <label htmlFor="sim-stuContact">Kontak siswa (UC-17)</label>
          <select id="sim-stuContact" value={sim.stuContact} onChange={(e) => setSim({ ...sim, stuContact: e.target.value as SimulationSettings['stuContact'] })}>
            <option value="auto">Sesuai data</option>
            <option value="missing">Kosong</option>
          </select>

          <label htmlFor="sim-parentLink">Relasi orang tua (UC-18)</label>
          <select id="sim-parentLink" value={sim.parentLink} onChange={(e) => setSim({ ...sim, parentLink: e.target.value as SimulationSettings['parentLink'] })}>
            <option value="auto">Terverifikasi</option>
            <option value="unverified">Belum terverifikasi</option>
          </select>

          <label htmlFor="sim-channel">Layanan pesan (UC-17/18)</label>
          <select id="sim-channel" value={sim.channel} onChange={(e) => setSim({ ...sim, channel: e.target.value as SimulationSettings['channel'] })}>
            <option value="sent">Terkirim</option>
            <option value="fail">Gagal</option>
          </select>

          <label htmlFor="sim-qris">Permintaan QRIS (UC-20)</label>
          <select id="sim-qris" value={sim.qris} onChange={(e) => setSim({ ...sim, qris: e.target.value as SimulationSettings['qris'] })}>
            <option value="ok">Valid</option>
            <option value="rejected">REJECTED</option>
          </select>
        </div>

        <hr />
        <h3>Layanan QRIS: kirim status (UC-20)</h3>
        <div className="sim">
          <label htmlFor="sp-status">Status penyedia</label>
          <select id="sp-status" value={simPay.status} onChange={(e) => setSimPay({ ...simPay, status: e.target.value as SimPaySettings['status'] })}>
            <option value="SUCCESS">SUCCESS</option>
            <option value="PENDING">PENDING</option>
            <option value="FAILED">FAILED</option>
          </select>

          <label htmlFor="sp-variant">Isi notifikasi</label>
          <select id="sp-variant" value={simPay.variant} onChange={(e) => setSimPay({ ...simPay, variant: e.target.value as SimPaySettings['variant'] })}>
            <option value="valid">Valid dan cocok</option>
            <option value="amount">Jumlah tidak sesuai</option>
            <option value="mismatch">Pengguna/paket tidak cocok</option>
          </select>
        </div>

        <button className="btn primary" onClick={handleProviderSend} type="button">
          Kirim notifikasi ke sistem
        </button>
        <span className="small muted">Target: transaksi yang sedang dibuka, atau transaksi aktif terakhir.</span>

        <hr />
        <button className="btn danger" onClick={handleResetDemo} type="button">
          Atur ulang data demo
        </button>
      </aside>

      {/* Floating Modals & Dialogs */}
      {modal}

      {/* Floating Toasts */}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.bad ? 'bad' : ''}`}>
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ===================== Screen Components ===================== */

/* S-00 Login */
function LoginPage({ onSelectRole }: { onSelectRole: (role: Role) => void }) {
  const [selectedRole, setSelectedRole] = useState<Role>('teacher')
  const [email, setEmail] = useState('rina@antiremed.id')
  const [password, setPassword] = useState('demo1234')
  const [errors, setErrors] = useState<{ email?: string; pass?: string }>({})

  const roleEmails: Record<Role, string> = {
    teacher: 'rina@antiremed.id',
    student: 'dimas@contoh.id',
    payer: 'sari@contoh.id',
  }

  function handleRolePick(r: Role) {
    setSelectedRole(r)
    setEmail(roleEmails[r])
    setErrors({})
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const err: { email?: string; pass?: string } = {}
    if (!email.trim()) err.email = 'Email wajib diisi'
    else if (!/^\S+@\S+\.\S+$/.test(email)) err.email = 'Format email tidak valid'
    if (!password) err.pass = 'Kata sandi wajib diisi'

    if (Object.keys(err).length) {
      setErrors(err)
      return
    }
    onSelectRole(selectedRole)
  }

  return (
    <div className="login">
      <div className="stack">
        <h1>Masuk ke Antiremed Soal Studio</h1>
        <p className="muted">Prototipe tugas AKPSI. Semua data adalah contoh; integrasi AI, penyimpanan, aplikasi kuis, WhatsApp, dan QRIS disimulasikan melalui Panel simulasi.</p>
      </div>

      <div className="roles" role="radiogroup" aria-label="Peran demo">
        {(
          [
            ['teacher', 'Pengajar', 'Membuat, meninjau, dan memaketkan soal'],
            ['student', 'Siswa', 'Mengerjakan paket di aplikasi kuis'],
            ['payer', 'Orang tua / pembayar', 'Menerima hasil dan membeli paket'],
          ] as const
        ).map(([k, t, d]) => (
          <button
            key={k}
            type="button"
            className={`rolecard ${selectedRole === k ? 'on' : ''}`}
            onClick={() => handleRolePick(k)}
            role="radio"
            aria-checked={selectedRole === k}
          >
            <b>{t}</b>
            <span className="muted small">{d}</span>
          </button>
        ))}
      </div>

      <form className="card stack" onSubmit={handleSubmit} noValidate>
        <div className="grid g2">
          <label className="f">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={errors.email ? 'invalid' : ''}
            />
            {errors.email && <span className="err">{errors.email}</span>}
          </label>
          <label className="f">
            Kata sandi
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={errors.pass ? 'invalid' : ''}
            />
            {errors.pass && <span className="err">{errors.pass}</span>}
          </label>
        </div>
        <div className="row between">
          <span className="muted small">Akun contoh terisi otomatis. Kosongkan field untuk melihat validasi.</span>
          <button className="btn primary" type="submit">
            Masuk
          </button>
        </div>
      </form>
    </div>
  )
}

/* S-01 Dashboard */
function DashboardPage({ data, onReviewQ }: { data: ReturnType<typeof initialSeed>; onReviewQ: (id: string) => void }) {
  const n = (s: QuestionItem['status']) => data.questions.filter((q) => q.status === s).length
  const needMedia = data.questions.filter((q) => q.mediaReq === 'Required' || q.mediaReq === 'NeedsCheck').length
  const ready = data.packages.filter((p) => p.status === 'Ready').length

  const greeting = new Date().getHours() < 11 ? 'pagi' : new Date().getHours() < 15 ? 'siang' : 'sore'

  return (
    <>
      <div className="head">
        <div>
          <h1>Selamat {greeting}, Bu Rina</h1>
          <p className="muted">Ringkasan bank soal hari ini.</p>
        </div>
        <div className="actions">
          <Link className="btn primary" to="/generator">
            Buat soal dengan AI
          </Link>
        </div>
      </div>

      <div className="grid g4">
        <Link className="card stat" to="/questions?status=InReview">
          <b>{n('InReview')}</b>
          <span>Menunggu peninjauan</span>
        </Link>
        <Link className="card stat" to="/questions?status=RevisionRequired">
          <b>{n('RevisionRequired')}</b>
          <span>Perlu revisi</span>
        </Link>
        <Link className="card stat" to="/questions?media=unmet">
          <b>{needMedia}</b>
          <span>Kebutuhan media belum terpenuhi</span>
        </Link>
        <Link className="card stat" to="/packages">
          <b>{ready}</b>
          <span>Paket siap digunakan</span>
        </Link>
      </div>

      <div className="split">
        <div className="card stack">
          <div className="row between">
            <h2>Antrean peninjauan</h2>
            <Link className="btn sm ghost" to="/questions?status=InReview">
              Lihat semua
            </Link>
          </div>
          {data.questions.filter((q) => q.status === 'InReview' || q.status === 'RevisionRequired').slice(0, 5).map((q) => (
            <div key={q.id} className="row between" style={{ borderTop: '1px solid var(--line)', paddingTop: '8px' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <span className="mono muted">{q.id}</span> {q.text.slice(0, 70)}…
                <div className="row small muted">
                  {SUBJECTS[q.subject] || q.subject} · {q.topic}{' '}
                  <span className={`chip ${MR_CLS[q.mediaReq]}`}>{MR_LABEL[q.mediaReq]}</span>
                </div>
              </div>
              <div className="row">
                <span className={`chip ${QS_CLS[q.status]}`}>{QS_LABEL[q.status]}</span>
                <button className="btn sm" onClick={() => onReviewQ(q.id)} type="button">
                  Tinjau
                </button>
              </div>
            </div>
          ))}
          {!data.questions.some((q) => q.status === 'InReview' || q.status === 'RevisionRequired') && (
            <div className="empty">Tidak ada soal yang menunggu peninjauan.</div>
          )}
        </div>

        <div className="card stack">
          <h2>Aktivitas sistem terbaru</h2>
          {data.log.slice(0, 6).map((l, idx) => (
            <div key={idx} className="small">
              <span className="tag">{l.uc}</span> {l.msg}
              <div className="muted mono">{l.t}</div>
            </div>
          ))}
          <Link className="btn sm ghost" to="/logs">
            Buka log
          </Link>
        </div>
      </div>
    </>
  )
}

/* S-02 Buat Soal AI */
function GeneratorPage({ onStartPipeline }: { onStartPipeline: (p: PipelineState) => void }) {
  const [level, setLevel] = useState('SMP Kelas 8')
  const [subject, setSubject] = useState('mtk')
  const [topic, setTopic] = useState('Teorema Pythagoras')
  const [count, setCount] = useState(3)
  const [diff, setDiff] = useState('Sedang')
  const [errors, setErrors] = useState<Record<string, string>>({})

  function handleSubjChange(s: string) {
    setSubject(s)
    setTopic((TOPICS[s] || [])[0] || '')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const err: Record<string, string> = {}
    if (!level) err.level = 'Pilih jenjang kelas'
    if (!subject) err.subject = 'Pilih mata pelajaran'
    if (!topic) err.topic = 'Pilih topik atau bab'
    if (!count || count < 1 || count > 5 || !Number.isInteger(+count)) err.count = 'Masukkan angka 1 sampai 5'

    if (Object.keys(err).length) {
      setErrors(err)
      return
    }

    onStartPipeline({
      p: { subject, level, topic, count: +count, diff },
      steps: ['run', 'wait', 'wait', 'wait'],
      notes: [],
      state: 'run',
      ids: [],
    })
  }

  return (
    <>
      <div className="head">
        <div>
          <h1>Buat soal dengan Generative AI</h1>
          <p className="muted">Tentukan parameter. Hasil AI masuk sebagai draf dan wajib ditinjau sebelum dipakai.</p>
        </div>
      </div>

      <div className="split">
        <form className="card stack" onSubmit={handleSubmit} noValidate>
          <div className="grid g2">
            <label className="f">
              Jenjang kelas
              <select value={level} onChange={(e) => setLevel(e.target.value)} className={errors.level ? 'invalid' : ''}>
                <option value="">Pilih jenjang</option>
                {LEVELS.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
              {errors.level && <span className="err">{errors.level}</span>}
            </label>

            <label className="f">
              Mata pelajaran
              <select value={subject} onChange={(e) => handleSubjChange(e.target.value)} className={errors.subject ? 'invalid' : ''}>
                <option value="">Pilih mata pelajaran</option>
                {Object.entries(SUBJECTS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              {errors.subject && <span className="err">{errors.subject}</span>}
            </label>

            <label className="f">
              Topik / bab
              <select value={topic} onChange={(e) => setTopic(e.target.value)} className={errors.topic ? 'invalid' : ''}>
                <option value="">Pilih topik</option>
                {(TOPICS[subject] || []).map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
              {errors.topic && <span className="err">{errors.topic}</span>}
            </label>

            <label className="f">
              Jumlah soal (1–5 pada prototipe)
              <input
                type="number"
                min={1}
                max={5}
                value={count}
                onChange={(e) => setCount(+e.target.value)}
                className={errors.count ? 'invalid' : ''}
              />
              {errors.count && <span className="err">{errors.count}</span>}
            </label>

            <label className="f">
              Tingkat kesulitan
              <select value={diff} onChange={(e) => setDiff(e.target.value)}>
                {['Mudah', 'Sedang', 'HOTS'].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="row between">
            <span className="muted small">Sistem memvalidasi parameter sebelum mengirim ke AI (UC-01 langkah 8).</span>
            <button className="btn primary" type="submit">
              Hasilkan soal
            </button>
          </div>
        </form>

        <div className="card flat stack small">
          <h3>Yang terjadi setelah Anda menekan Hasilkan</h3>
          <p>1. Generative AI membuat pertanyaan, pilihan, dan kunci (UC-01).</p>
          <p>2. AI menulis penjelasan untuk setiap pilihan (UC-02).</p>
          <p>3. Sistem menyusun data terstruktur dan metadata taksonomi (UC-03, FR-04).</p>
          <p>4. Multimodal AI mendeteksi kebutuhan media (UC-08).</p>
          <p className="muted">Ubah respons simulasi lewat Panel simulasi: AI gagal, penjelasan tidak lengkap.</p>
        </div>
      </div>
    </>
  )
}

/* S-03 Pipeline AI */
function PipelinePage({
  pipeline,
  data,
  setData,
  sim,
  addLog,
  showToast,
  onReviewQ,
}: {
  pipeline: PipelineState | null
  data: ReturnType<typeof initialSeed>
  setData: React.Dispatch<React.SetStateAction<ReturnType<typeof initialSeed>>>
  sim: SimulationSettings
  addLog: (uc: string, msg: string) => void
  showToast: (msg: string, bad?: boolean) => void
  onReviewQ: (id: string) => void
}) {
  const [pState, setPState] = useState<PipelineState | null>(pipeline)
  const ranRef = useRef(false)

  const names = [
    ['UC-01', 'Menghasilkan pertanyaan, pilihan, dan kunci'],
    ['UC-02', 'Membuat penjelasan setiap pilihan jawaban'],
    ['UC-03', 'Menyusun struktur data terstandar dan metadata'],
    ['UC-08', 'Mendeteksi kebutuhan media visual'],
  ]

  useEffect(() => {
    if (!pipeline || ranRef.current) return
    ranRef.current = true

    async function execute() {
      if (!pipeline) return
      const p = pipeline.p
      await wait(800)

      if (sim.ai === 'fail') {
        setPState((prev) => (prev ? {
          ...prev,
          steps: ['fail', 'wait', 'wait', 'wait'],
          notes: ['Batas waktu 120 detik terlewati (simulasi)'],
          state: 'fail',
        } : null))
        addLog('UC-01', 'Generative AI gagal menghasilkan soal (A2), tidak ada data tersimpan')
        return
      }

      const pool = POOL[p.subject] || POOL.mtk
      const ids: string[] = []
      const newQuestions: QuestionItem[] = []
      let nextSeqQ = data.seq.q

      for (let i = 0; i < p.count; i++) {
        const src = pool[i % pool.length]
        const id = 'Q-' + nextSeqQ++
        const q = mkQ(id, p.subject, p.level, p.topic, src, 'Draft', { difficulty: p.diff, createdAt: now(), mediaReq: 'NotRequired' })
        ;(q as QuestionItem & { _mr?: QuestionItem['mediaReq'] })._mr = src.mr
        newQuestions.push(q)
        ids.push(id)
      }

      setPState((prev) => (prev ? {
        ...prev,
        ids,
        steps: ['done', 'run', 'wait', 'wait'],
        notes: [`${ids.length} soal`],
      } : null))
      addLog('UC-01', `Generative AI menghasilkan ${ids.length} soal (${ids.join(', ')})`)

      await wait(800)
      let warn = ''
      if (sim.explain === 'incomplete') {
        newQuestions[0].options[3].explanation = ''
        newQuestions[0].flags = ['Penjelasan opsi D kosong']
        warn = 'Satu soal ditandai Perlu Revisi karena penjelasan opsi D kosong (UC-02 A2).'
        setPState((prev) => (prev ? {
          ...prev,
          steps: ['done', 'warn', 'run', 'wait'],
          notes: [prev.notes[0], '1 soal penjelasannya tidak lengkap'],
        } : null))
        addLog('UC-02', `Penjelasan ${ids[0]} tidak lengkap, ditandai untuk perbaikan`)
      } else {
        setPState((prev) => (prev ? {
          ...prev,
          steps: ['done', 'done', 'run', 'wait'],
          notes: [prev.notes[0], 'Semua opsi berpenjelasan'],
        } : null))
        addLog('UC-02', `Penjelasan dibuat untuk ${ids.length} soal`)
      }

      await wait(700)
      setPState((prev) => (prev ? {
        ...prev,
        steps: ['done', prev.steps[1], 'done', 'run'],
        notes: [prev.notes[0], prev.notes[1], `Metadata: ${SUBJECTS[p.subject] || p.subject}, ${p.level}, ${p.topic}`],
      } : null))
      addLog('UC-03', `Struktur data dan metadata tersimpan untuk ${ids.length} soal`)

      await wait(800)
      const cnt = { Required: 0, NeedsCheck: 0 }
      newQuestions.forEach((q) => {
        let mr = (q as QuestionItem & { _mr?: QuestionItem['mediaReq'] })._mr || 'NotRequired'
        if (sim.detect !== 'auto') mr = sim.detect
        q.mediaReq = mr
        delete (q as QuestionItem & { _mr?: QuestionItem['mediaReq'] })._mr
        if (mr === 'Required') cnt.Required++
        if (mr === 'NeedsCheck') cnt.NeedsCheck++
        q.status = q.flags.length ? 'RevisionRequired' : 'InReview'
        addLog('UC-08', `${q.id}: ${MR_LABEL[mr]}`)
      })

      setData((prev) => ({
        ...prev,
        questions: [...newQuestions, ...prev.questions],
        seq: { ...prev.seq, q: nextSeqQ },
      }))

      setPState((prev) => (prev ? {
        ...prev,
        steps: ['done', prev.steps[1], 'done', cnt.NeedsCheck ? 'warn' : 'done'],
        notes: [prev.notes[0], prev.notes[1], prev.notes[2], `${cnt.Required} butuh media, ${cnt.NeedsCheck} perlu dicek`],
        state: 'done',
        warn,
      } : null))
      showToast('Soal siap ditinjau')
    }

    execute()
  }, [pipeline, sim, data.seq.q, addLog, setData, showToast])

  if (!pState) {
    return (
      <div className="empty">
        Belum ada proses berjalan.
        <Link className="btn" to="/generator">
          Buat soal
        </Link>
      </div>
    )
  }

  const { p, steps, notes, state, ids, warn } = pState

  return (
    <>
      <div className="head">
        <div>
          <h1>Proses AI</h1>
          <p className="muted">
            {SUBJECTS[p.subject] || p.subject} · {p.level} · {p.topic} · {p.count} soal
          </p>
        </div>
      </div>

      <div className="split">
        <div className="card">
          <div className="pipe">
            {names.map(([uc, n], i) => {
              const s = steps[i] || 'wait'
              return (
                <div key={uc} className={`step ${s}`}>
                  <div className="dot">{s === 'done' ? '✓' : s === 'fail' || s === 'warn' ? '!' : ''}</div>
                  <div>
                    <b>{n}</b>
                    <div className="small muted">
                      {uc}
                      {notes[i] ? ' · ' + notes[i] : ''}
                    </div>
                  </div>
                  <span className="small muted">
                    {({ wait: 'Menunggu', run: 'Berjalan', done: 'Selesai', fail: 'Gagal', warn: 'Selesai dengan catatan' } as Record<string, string>)[s] || s}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="stack">
          {state === 'fail' ? (
            <>
              <div className="note bad">
                <div>
                  <b>Generative AI tidak merespons.</b> Tidak ada soal yang disimpan dan parameter Anda masih ada. Coba lagi atau ubah parameter.
                </div>
              </div>
              <div className="row">
                <Link className="btn primary" to="/generator">
                  Coba lagi
                </Link>
              </div>
            </>
          ) : state === 'done' ? (
            <>
              <div className={`note ${warn ? 'warn' : 'ok'}`}>
                <div>
                  <b>{ids.length} soal tersimpan sebagai draf terstruktur.</b> {warn || 'Soal siap ditinjau.'}
                </div>
              </div>
              <div className="card stack">
                {ids.map((qid: string) => {
                  const q = data.questions.find((x) => x.id === qid)
                  if (!q) return null
                  return (
                    <div className="row between" key={qid}>
                      <span>
                        <span className="mono">{qid}</span> <span className={`chip ${QS_CLS[q.status]}`}>{QS_LABEL[q.status]}</span>{' '}
                        <span className={`chip ${MR_CLS[q.mediaReq]}`}>{MR_LABEL[q.mediaReq]}</span>
                      </span>
                      <button className="btn sm" onClick={() => onReviewQ(qid)} type="button">
                        Tinjau
                      </button>
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <div className="note info">
              <div>AI sedang bekerja. Anda dapat meninggalkan halaman ini; proses berlanjut di latar belakang (NFR-05).</div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

/* S-04 Bank Soal */
function BankPage({ data, onReviewQ }: { data: ReturnType<typeof initialSeed>; onReviewQ: (id: string) => void }) {
  const [searchParams, setSearchParams] = useState({
    qtext: '',
    status: '',
    subject: '',
    level: '',
    topic: '',
    media: '',
  })

  const topics = useMemo(() => [...new Set(Object.values(TOPICS).flat())], [])

  const filtered = useMemo(() => {
    return data.questions.filter((q) => {
      if (searchParams.status && q.status !== searchParams.status) return false
      if (searchParams.subject && q.subject !== searchParams.subject) return false
      if (searchParams.level && q.level !== searchParams.level) return false
      if (searchParams.topic && q.topic !== searchParams.topic) return false
      if (searchParams.media) {
        if (searchParams.media === 'unmet' && !(q.mediaReq === 'Required' || q.mediaReq === 'NeedsCheck')) return false
        if (searchParams.media !== 'unmet' && q.mediaReq !== searchParams.media) return false
      }
      if (searchParams.qtext) {
        const needle = searchParams.qtext.toLowerCase()
        if (!(q.text + q.id).toLowerCase().includes(needle)) return false
      }
      return true
    })
  }, [data.questions, searchParams])

  return (
    <>
      <div className="head">
        <div>
          <h1>Bank soal</h1>
          <p className="muted">Cari dan saring soal berdasarkan taksonomi (FR-04) dan status validasi.</p>
        </div>
        <div className="actions">
          <Link className="btn primary" to="/generator">
            Buat soal
          </Link>
        </div>
      </div>

      <div className="card grid g3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        <label className="f">
          Cari
          <input
            type="text"
            placeholder="ID atau kata kunci"
            value={searchParams.qtext}
            onChange={(e) => setSearchParams({ ...searchParams, qtext: e.target.value })}
          />
        </label>
        <label className="f">
          Status
          <select value={searchParams.status} onChange={(e) => setSearchParams({ ...searchParams, status: e.target.value })}>
            <option value="">Semua</option>
            {Object.entries(QS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="f">
          Mata pelajaran
          <select value={searchParams.subject} onChange={(e) => setSearchParams({ ...searchParams, subject: e.target.value })}>
            <option value="">Semua</option>
            {Object.entries(SUBJECTS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="f">
          Jenjang
          <select value={searchParams.level} onChange={(e) => setSearchParams({ ...searchParams, level: e.target.value })}>
            <option value="">Semua</option>
            {LEVELS.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </label>
        <label className="f">
          Topik
          <select value={searchParams.topic} onChange={(e) => setSearchParams({ ...searchParams, topic: e.target.value })}>
            <option value="">Semua</option>
            {topics.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="f">
          Media
          <select value={searchParams.media} onChange={(e) => setSearchParams({ ...searchParams, media: e.target.value })}>
            <option value="">Semua</option>
            <option value="unmet">Belum terpenuhi</option>
            {Object.entries(MR_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </div>

      {filtered.length ? (
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Pertanyaan</th>
                <th>Taksonomi</th>
                <th>Media</th>
                <th>Status</th>
                <th>Versi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((q) => (
                <tr key={q.id} className="click" onClick={() => onReviewQ(q.id)} tabIndex={0}>
                  <td className="mono">{q.id}</td>
                  <td style={{ minWidth: 240 }}>
                    {q.text.slice(0, 90)}
                    {q.text.length > 90 ? '…' : ''}
                  </td>
                  <td className="small">
                    {SUBJECTS[q.subject] || q.subject}
                    <br />
                    <span className="muted">
                      {q.level} · {q.topic}
                    </span>
                  </td>
                  <td>
                    <span className={`chip ${MR_CLS[q.mediaReq]}`}>{MR_LABEL[q.mediaReq]}</span>
                  </td>
                  <td>
                    <span className={`chip ${QS_CLS[q.status]}`}>{QS_LABEL[q.status]}</span>
                  </td>
                  <td className="num mono">v{q.version}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card empty">
          <b>Tidak ada soal yang cocok dengan filter.</b>
          <span>Ubah atau kosongkan filter untuk melihat soal lain.</span>
          <button
            className="btn"
            onClick={() => setSearchParams({ qtext: '', status: '', subject: '', level: '', topic: '', media: '' })}
            type="button"
          >
            Kosongkan filter
          </button>
        </div>
      )}
    </>
  )
}

/* S-05 Tinjau Soal */
function ReviewPage({
  data,
  setData,
  addLog,
  showToast,
  setModal,
  onEditQ,
  onMediaQ,
}: {
  data: ReturnType<typeof initialSeed>
  setData: React.Dispatch<React.SetStateAction<ReturnType<typeof initialSeed>>>
  addLog: (uc: string, msg: string) => void
  showToast: (msg: string, bad?: boolean) => void
  setModal: React.Dispatch<React.SetStateAction<React.ReactNode | null>>
  onEditQ: (id: string) => void
  onMediaQ: (id: string) => void
}) {
  const { id } = useParams()
  const navigate = useNavigate()
  const q = data.questions.find((x) => x.id === id) || data.questions[0]
  const iss = useMemo(() => checkIssues(q), [q])
  const canDecide = q.status === 'InReview' || q.status === 'RevisionRequired'

  function handleAccept() {
    setModal(
      <div className="scrim">
        <div className="dialog" role="dialog" aria-modal="true">
          <h2>Terima soal {q.id}?</h2>
          <p>Soal akan berstatus Tervalidasi dan dapat dipakai dalam paket.</p>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => setModal(null)} type="button">
              Batal
            </button>
            <button
              className="btn primary"
              onClick={() => {
                setModal(null)
                setData((prev) => ({
                  ...prev,
                  questions: prev.questions.map((item) =>
                    item.id === q.id
                      ? {
                          ...item,
                          status: 'Accepted',
                          history: [{ at: now(), by: 'Bu Rina', d: 'Terima', c: '' }, ...item.history],
                        }
                      : item
                  ),
                }))
                addLog('UC-05', `${q.id} diterima → Tervalidasi`)
                showToast('Soal tervalidasi')
              }}
              type="button"
            >
              Terima
            </button>
          </div>
        </div>
      </div>
    )
  }

  function handleReject() {
    let reason = ''
    setModal(
      <div className="scrim">
        <form
          className="dialog"
          onSubmit={(e) => {
            e.preventDefault()
            if (!reason.trim()) return
            setModal(null)
            setData((prev) => ({
              ...prev,
              questions: prev.questions.map((item) =>
                item.id === q.id
                  ? {
                      ...item,
                      status: 'Rejected',
                      history: [{ at: now(), by: 'Bu Rina', d: 'Tolak', c: reason.trim() }, ...item.history],
                    }
                  : item
              ),
            }))
            addLog('UC-07', `${q.id} ditolak: ${reason.trim()}`)
            showToast('Soal ditolak')
          }}
          role="dialog"
          aria-modal="true"
        >
          <h2>Tolak soal {q.id}</h2>
          <p className="small">Soal yang ditolak tidak dapat dipakai dalam paket dan disimpan sebagai riwayat.</p>
          <label className="f">
            Alasan penolakan
            <textarea
              placeholder="Contoh: konsep keliru, opsi ambigu"
              onChange={(e) => (reason = e.target.value)}
              required
            />
          </label>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => setModal(null)} type="button">
              Batal
            </button>
            <button className="btn danger" type="submit">
              Tolak soal
            </button>
          </div>
        </form>
      </div>
    )
  }

  function handleDefer() {
    setData((prev) => ({
      ...prev,
      questions: prev.questions.map((item) =>
        item.id === q.id
          ? {
              ...item,
              status: 'RevisionRequired',
              history: [{ at: now(), by: 'Bu Rina', d: 'Tunda (perlu revisi)', c: '' }, ...item.history],
            }
          : item
      ),
    }))
    addLog('UC-04', `${q.id} ditunda → Perlu Revisi (A1)`)
    showToast('Soal ditandai perlu revisi')
  }

  const linkedMedia = q.mediaIds.map((mid) => data.media.find((m) => m.id === mid)).filter(Boolean) as MediaItem[]

  return (
    <>
      <div className="head">
        <div>
          <button className="btn sm ghost" onClick={() => navigate('/questions')} type="button">
            ← Bank soal
          </button>
          <h1>
            <span className="mono">{q.id}</span> Tinjau soal
          </h1>
          <p className="muted">
            {SUBJECTS[q.subject] || q.subject} · {q.level} · {q.topic} · {q.difficulty} · v{q.version} · {q.source}
          </p>
        </div>
        <div className="row">
          <span className={`chip ${QS_CLS[q.status]}`}>{QS_LABEL[q.status]}</span>
          <span className={`chip ${MR_CLS[q.mediaReq]}`}>{MR_LABEL[q.mediaReq]}</span>
        </div>
      </div>

      {q.status === 'Rejected' && (
        <div className="note bad">
          <div>
            <b>Soal ditolak.</b> Soal disimpan sebagai riwayat dan tidak dapat dipakai dalam paket.
          </div>
        </div>
      )}

      {q.status === 'Accepted' && (
        <div className="note ok">
          <div>
            <b>Soal tervalidasi.</b> Soal dapat dipilih saat menyusun paket. Mengubah soal ini akan mengembalikannya ke peninjauan.
          </div>
        </div>
      )}

      <div className="split">
        <div className="card stack">
          <p className="q-text">{q.text}</p>

          {linkedMedia.map((m) => (
            <div key={m.id} className="media-box">
              <img src={m.img || m.filePath} alt={m.title} />
              <div className="small">
                <b>{m.title}</b>
                <br />
                {m.source} · {m.rights}
                <br />
                <span className={`chip ${MS_CLS[m.status]}`}>{MS_LABEL[m.status]}</span> <span className="mono muted">{m.id}</span>
              </div>
            </div>
          ))}

          {!linkedMedia.length && (q.mediaReq === 'Required' || q.mediaReq === 'NeedsCheck') && (
            <div className="media-box">
              <span className="muted">
                Soal ini {q.mediaReq === 'Required' ? 'membutuhkan media visual' : 'mungkin membutuhkan media (hasil deteksi tidak meyakinkan)'}.
              </span>
              <button className="btn sm" onClick={() => onMediaQ(q.id)} type="button">
                Kelola media
              </button>
            </div>
          )}

          {q.options.map((o) => (
            <div key={o.label} className={`opt ${o.isCorrect ? 'ok' : ''}`}>
              <span className="l">{o.label}</span>
              <div>
                <div>
                  {o.text} {o.isCorrect && <span className="chip c-ok">Jawaban benar</span>}
                </div>
                <div className={`expl ${o.explanation ? '' : 'missing'}`}>
                  {o.explanation ? o.explanation : 'Penjelasan belum tersedia'}
                </div>
              </div>
            </div>
          ))}

          <p className="small">
            <b>Konsep:</b> {q.concept || '-'}
          </p>
        </div>

        <div className="stack">
          <div className="card stack">
            <h3>Pemeriksaan kelengkapan</h3>
            {iss.length ? (
              iss.map((i) => (
                <div key={i} className="small" style={{ color: 'var(--bad)' }}>
                  ✕ {i}
                </div>
              ))
            ) : (
              <div className="small" style={{ color: 'var(--ok)' }}>
                ✓ Pertanyaan, pilihan, kunci, penjelasan, dan media lengkap
              </div>
            )}
            <div className="small muted">
              Struktur data (UC-03): {q.options.length} pilihan terpetakan, metadata lengkap.
            </div>
          </div>

          {canDecide ? (
            <div className="card stack">
              <h3>Keputusan peninjauan</h3>
              <button className="btn primary" onClick={handleAccept} disabled={iss.length > 0} type="button">
                Terima soal
              </button>
              {iss.length > 0 && <span className="small muted">Terima nonaktif sampai kekurangan di atas diperbaiki (UC-05 A2).</span>}
              <button className="btn" onClick={() => onEditQ(q.id)} type="button">
                Ubah soal
              </button>
              {q.mediaReq !== 'NotRequired' && (
                <button className="btn" onClick={() => onMediaQ(q.id)} type="button">
                  Kelola media
                </button>
              )}
              {q.status === 'InReview' && (
                <button className="btn" onClick={handleDefer} type="button">
                  Tunda, tandai perlu revisi
                </button>
              )}
              <button className="btn danger" onClick={handleReject} type="button">
                Tolak soal
              </button>
            </div>
          ) : q.status === 'Accepted' ? (
            <div className="card stack">
              <button className="btn" onClick={() => onEditQ(q.id)} type="button">
                Ubah soal tervalidasi
              </button>
            </div>
          ) : null}

          <div className="card stack">
            <h3>Riwayat peninjauan</h3>
            {q.history.length ? (
              q.history.map((h, idx) => (
                <div key={idx} className="small">
                  <b>{h.d}</b> oleh {h.by} <span className="mono muted">{h.at}</span>
                  {h.c && <div className="muted">“{h.c}”</div>}
                </div>
              ))
            ) : (
              <span className="small muted">Belum ada keputusan.</span>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

/* S-06 Ubah Soal */
function EditPage({
  data,
  setData,
  addLog,
  showToast,
}: {
  data: ReturnType<typeof initialSeed>
  setData: React.Dispatch<React.SetStateAction<ReturnType<typeof initialSeed>>>
  addLog: (uc: string, msg: string) => void
  showToast: (msg: string) => void
}) {
  const { id } = useParams()
  const navigate = useNavigate()
  const q = data.questions.find((x) => x.id === id) || data.questions[0]

  const [text, setText] = useState(q.text)
  const [options, setOptions] = useState<Option[]>(() => JSON.parse(JSON.stringify(q.options)))
  const [errors, setErrors] = useState<Record<string, string>>({})

  function handleCorrectChange(idx: number) {
    setOptions((prev) => prev.map((o, i) => ({ ...o, isCorrect: i === idx })))
  }

  function handleOptionTextChange(idx: number, val: string) {
    setOptions((prev) => prev.map((o, i) => (i === idx ? { ...o, text: val } : o)))
  }

  function handleOptionExplChange(idx: number, val: string) {
    setOptions((prev) => prev.map((o, i) => (i === idx ? { ...o, explanation: val } : o)))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const err: Record<string, string> = {}
    if (!text.trim()) err.text = 'Pertanyaan wajib diisi'
    options.forEach((o, i) => {
      if (!o.text.trim()) err['o' + i] = 'Teks pilihan wajib diisi'
      if (!o.explanation.trim()) err['x' + i] = 'Penjelasan wajib diisi'
    })
    if (!options.some((o) => o.isCorrect)) err.correct = 'Pilih satu jawaban benar'

    if (Object.keys(err).length) {
      setErrors(err)
      return
    }

    const wasAccepted = q.status === 'Accepted'
    const nextVer = q.version + 1

    setData((prev) => ({
      ...prev,
      questions: prev.questions.map((item) =>
        item.id === q.id
          ? {
              ...item,
              text,
              options,
              version: nextVer,
              flags: [],
              status: 'InReview',
              history: [
                {
                  at: now(),
                  by: 'Bu Rina',
                  d: `Ubah (v${nextVer})`,
                  c: wasAccepted ? 'Soal tervalidasi diubah, kembali ke peninjauan' : '',
                },
                ...item.history,
              ],
            }
          : item
      ),
    }))

    addLog('UC-06', `${q.id} disimpan sebagai v${nextVer} → Menunggu Peninjauan`)
    showToast(`Versi v${nextVer} tersimpan`)
    navigate(`/questions/${q.id}`)
  }

  return (
    <>
      <div className="head">
        <div>
          <h1>
            Ubah soal <span className="mono">{q.id}</span>
          </h1>
          <p className="muted">
            Menyimpan membuat versi v{q.version + 1}.{' '}
            {q.status === 'Accepted'
              ? `Soal akan kembali ke Menunggu Peninjauan; paket yang ada tetap memakai versi v${q.version}.`
              : 'Status setelah simpan: Menunggu Peninjauan.'}
          </p>
        </div>
      </div>

      {Object.keys(errors).length > 0 && (
        <div className="note bad">
          <div>
            <b>Perubahan belum dapat disimpan.</b> Perbaiki field bertanda merah (UC-06 A1).
          </div>
        </div>
      )}

      <form className="card stack" onSubmit={handleSubmit} noValidate>
        <label className="f">
          Pertanyaan
          <textarea value={text} onChange={(e) => setText(e.target.value)} className={errors.text ? 'invalid' : ''} />
          {errors.text && <span className="err">{errors.text}</span>}
        </label>

        <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="small">
            <b>Pilihan jawaban</b> · pilih satu jawaban benar
          </legend>
          {errors.correct && <span className="err">{errors.correct}</span>}

          {options.map((o, i) => (
            <div
              key={o.label}
              className="card flat grid"
              style={{ gridTemplateColumns: 'auto minmax(0,1fr) minmax(0,1.3fr)', gap: 8, alignItems: 'start' }}
            >
              <label className="check" style={{ paddingTop: 8 }}>
                <input
                  type="radio"
                  name="eCorrect"
                  value={i}
                  checked={o.isCorrect}
                  onChange={() => handleCorrectChange(i)}
                />
                <span className="mono">{o.label}</span>
              </label>
              <label className="f">
                Teks pilihan
                <input
                  type="text"
                  value={o.text}
                  onChange={(e) => handleOptionTextChange(i, e.target.value)}
                  className={errors['o' + i] ? 'invalid' : ''}
                />
                {errors['o' + i] && <span className="err">{errors['o' + i]}</span>}
              </label>
              <label className="f">
                Penjelasan
                <textarea
                  value={o.explanation}
                  onChange={(e) => handleOptionExplChange(i, e.target.value)}
                  className={errors['x' + i] ? 'invalid' : ''}
                  style={{ minHeight: 40 }}
                />
                {errors['x' + i] && <span className="err">{errors['x' + i]}</span>}
              </label>
            </div>
          ))}
        </fieldset>

        <div className="row between">
          <button className="btn" onClick={() => navigate(`/questions/${q.id}`)} type="button">
            Batal
          </button>
          <button className="btn primary" type="submit">
            Simpan versi baru
          </button>
        </div>
      </form>
    </>
  )
}

/* S-07 Media Soal Workbench */
function MediaWorkbenchPage({
  data,
  setData,
  sim,
  addLog,
  showToast,
}: {
  data: ReturnType<typeof initialSeed>
  setData: React.Dispatch<React.SetStateAction<ReturnType<typeof initialSeed>>>
  sim: SimulationSettings
  addLog: (uc: string, msg: string) => void
  showToast: (msg: string) => void
}) {
  const { id } = useParams()
  const navigate = useNavigate()
  const q = data.questions.find((x) => x.id === id) || data.questions[0]

  const [tab, setTab] = useState<'repo' | 'ext' | 'ai'>('repo')
  const [loading, setLoading] = useState(false)
  const [cands, setCands] = useState<MediaCandidate[]>([])
  const [err, setErr] = useState('')
  const [empty, setEmpty] = useState(false)
  const [uploadSteps, setUploadSteps] = useState<string[]>([])
  const [uploadFail, setUploadFail] = useState(false)
  const [pendingCand, setPendingCand] = useState<MediaCandidate | null>(null)

  function topicKey(question: QuestionItem) {
    return question.topic.includes('Pythagoras') ? 'tri' : question.topic.includes('Parabola') ? 'para' : question.topic.includes('Statistika') ? 'bar' : 'cell'
  }

  async function handleSearch() {
    setLoading(true)
    setCands([])
    setErr('')
    setEmpty(false)
    await wait(700)
    setLoading(false)

    if (tab === 'repo') {
      addLog('UC-10', `Cari repositori untuk ${q.id}`)
      if (sim.repo === 'none') {
        setEmpty(true)
      } else {
        const ms = data.media.filter((m) => m.status !== 'Archived' && m.img === IMG[topicKey(q)])
        if (!ms.length) setEmpty(true)
        else {
          setCands(ms.map((m) => ({ title: m.title, img: m.img || '', source: 'Repositori internal · ' + m.id, rights: m.rights, ok: true, existing: m.id })))
        }
      }
    } else if (tab === 'ext') {
      addLog('UC-09', `Cari sumber diperbolehkan untuk ${q.id}`)
      if (sim.ext === 'down') {
        setErr('Sumber media tidak dapat dihubungi. Kegagalan dicatat; coba lagi beberapa saat lagi (UC-09 A2).')
      } else if (sim.ext === 'none') {
        setEmpty(true)
      } else {
        const k = topicKey(q)
        setCands([
          { title: 'Diagram ' + q.topic.toLowerCase() + ' (CC BY 4.0)', img: k === 'tri' ? IMG.tri2 : IMG[k], source: 'Sumber diperbolehkan · repositori pendidikan terbuka', rights: 'CC BY 4.0', ok: true },
          { title: 'Ilustrasi ' + q.topic.toLowerCase() + ' dari galeri umum', img: k === 'tri' ? IMG.tri3 : IMG[k], source: 'Sumber diperbolehkan · galeri umum', rights: '', ok: false },
        ])
      }
    } else {
      addLog('UC-11', `Generate media untuk ${q.id}`)
      if (sim.img === 'fail') {
        setErr('Layanan AI Image Generation gagal membuat gambar. Kegagalan dicatat; Anda dapat mencoba lagi atau beralih ke pencarian (UC-11 A1).')
      } else {
        setCands([
          { title: 'Gambar hasil AI: ' + q.topic.toLowerCase(), img: topicKey(q) === 'tri' ? IMG.tri3 : IMG[topicKey(q)], source: 'AI Image Generation', rights: 'Dibuat untuk Antiremed', ok: true, ai: true },
        ])
      }
    }
  }

  const linkMedia = useCallback((mediaId: string) => {
    setData((prev) => ({
      ...prev,
      questions: prev.questions.map((item) =>
        item.id === q.id
          ? {
              ...item,
              mediaReq: 'Fulfilled',
              mediaIds: item.mediaIds.includes(mediaId) ? item.mediaIds : [...item.mediaIds, mediaId],
            }
          : item
      ),
    }))
  }, [q.id, setData])

  async function handleUse(c: MediaCandidate) {
    setCands([])
    setPendingCand(c)
    const steps = ['Media disetujui pengajar (PendingReview → Approved)']
    setUploadSteps(steps)

    if (c.existing) {
      const m = data.media.find((x) => x.id === c.existing)
      if (m) m.status = 'Linked'
      linkMedia(c.existing)
      setUploadSteps([...steps, 'Media repositori dipakai ulang tanpa unggah ulang (UC-12 A4)', '✓ Tautan disimpan dan dihubungkan ke soal'])
      addLog('UC-12', `${c.existing} ditautkan ke ${q.id} (pakai ulang)`)
      showToast('Media tertaut ke soal')
      return
    }

    // Upload simulation
    let success = false
    for (let a = 1; a <= 3; a++) {
      steps.push(`Mengunggah ke Google Cloud Storage, percobaan ${a}…`)
      setUploadSteps([...steps])
      await wait(500)
      if (sim.upload === 'success') {
        const mId = 'M-' + data.seq.m
        const newMedia: MediaItem = {
          id: mId,
          title: c.title,
          img: c.img,
          source: c.source,
          rights: c.rights,
          status: 'Linked',
          tags: [q.topic.toLowerCase()],
        }
        setData((prev) => ({
          ...prev,
          media: [newMedia, ...prev.media],
          seq: { ...prev.seq, m: prev.seq.m + 1 },
        }))
        linkMedia(mId)
        steps.push(`✓ Tersimpan sebagai ${mId}, tautan diperoleh dan dihubungkan ke soal`)
        setUploadSteps([...steps])
        addLog('UC-12', `${mId} disimpan dan ditautkan ke ${q.id}`)
        showToast('Media tersimpan dan tertaut')
        success = true
        break
      }
      steps.push(`✕ Percobaan ${a} gagal`)
      setUploadSteps([...steps])
    }

    if (!success) {
      steps.push('Media ditandai Tidak tersedia. Soal belum ditandai media terpenuhi (UC-12 A3).')
      setUploadSteps([...steps])
      setUploadFail(true)
      addLog('UC-12', `Unggah media untuk ${q.id} gagal setelah 3 percobaan`)
    }
  }

  const linked = q.mediaIds.map((mid) => data.media.find((m) => m.id === mid)).filter(Boolean) as MediaItem[]

  return (
    <>
      <div className="head">
        <div>
          <button className="btn sm ghost" onClick={() => navigate(`/questions/${q.id}`)} type="button">
            ← Kembali ke tinjauan
          </button>
          <h1>
            Media soal <span className="mono">{q.id}</span>
          </h1>
          <p className="muted">{q.text.slice(0, 110)}…</p>
        </div>
        <div>
          <span className={`chip ${MR_CLS[q.mediaReq]}`}>{MR_LABEL[q.mediaReq]}</span>
        </div>
      </div>

      {linked.length > 0 && (
        <div className="card stack">
          <h3>Media tertaut</h3>
          {linked.map((m) => (
            <div key={m.id} className="media-box">
              <img src={m.img || m.filePath} alt={m.title} />
              <div className="small">
                <b>{m.title}</b>
                <br />
                {m.source} · {m.rights}
                <br />
                <span className={`chip ${MS_CLS[m.status]}`}>{MS_LABEL[m.status]}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card stack">
        {q.mediaReq === 'NeedsCheck' ? (
          <>
            <div className="note warn">
              <div>
                <b>Hasil deteksi tidak meyakinkan (UC-08 A1).</b> Pastikan apakah soal ini memerlukan media.
              </div>
            </div>
            <div className="row">
              <button
                className="btn primary"
                onClick={() => {
                  setData((prev) => ({
                    ...prev,
                    questions: prev.questions.map((item) => (item.id === q.id ? { ...item, mediaReq: 'Required' } : item)),
                  }))
                  addLog('UC-08', `Pengajar memastikan kebutuhan media ${q.id}: Butuh media`)
                }}
                type="button"
              >
                Ya, butuh media
              </button>
              <button
                className="btn"
                onClick={() => {
                  setData((prev) => ({
                    ...prev,
                    questions: prev.questions.map((item) => (item.id === q.id ? { ...item, mediaReq: 'NotRequired' } : item)),
                  }))
                  addLog('UC-08', `Pengajar memastikan kebutuhan media ${q.id}: Tanpa media`)
                }}
                type="button"
              >
                Tidak perlu media
              </button>
            </div>
          </>
        ) : q.mediaReq === 'NotRequired' ? (
          <>
            <div className="note info">
              <div>Soal ini tidak memerlukan media visual. Tidak ada tindakan yang diperlukan.</div>
            </div>
            <button
              className="btn sm"
              onClick={() => {
                setData((prev) => ({
                  ...prev,
                  questions: prev.questions.map((item) => (item.id === q.id ? { ...item, mediaReq: 'Required' } : item)),
                }))
              }}
              type="button"
            >
              Tandai butuh media
            </button>
          </>
        ) : (
          <>
            <div className="tabs" role="tablist">
              {[
                ['repo', 'Repositori Antiremed', 'UC-10'],
                ['ext', 'Sumber diperbolehkan', 'UC-09'],
                ['ai', 'Hasilkan dengan AI', 'UC-11'],
              ].map(([k, l, u]) => (
                <button
                  key={k}
                  className={`tab ${tab === k ? 'on' : ''}`}
                  onClick={() => {
                    setTab(k as 'repo' | 'ext' | 'ai')
                    setCands([])
                    setErr('')
                    setEmpty(false)
                  }}
                  role="tab"
                  aria-selected={tab === k}
                  type="button"
                >
                  {l} <span className="tag">{u}</span>
                </button>
              ))}
            </div>

            {tab === 'ai' ? (
              <div className="row" style={{ alignItems: 'flex-end' }}>
                <label className="f" style={{ flex: 1 }}>
                  Deskripsi gambar (prompt)
                  <input
                    type="text"
                    defaultValue={`Diagram ${q.topic.toLowerCase()} sesuai soal, label jelas, gaya buku pelajaran`}
                  />
                </label>
                <button className={`btn primary ${loading ? 'loading' : ''}`} onClick={handleSearch} disabled={loading} type="button">
                  Hasilkan
                </button>
              </div>
            ) : (
              <div className="row">
                <span className="muted small">
                  Kata kunci otomatis dari isi soal: <b>{q.topic.toLowerCase()}</b>
                </span>
                <button className={`btn primary ${loading ? 'loading' : ''}`} onClick={handleSearch} disabled={loading} type="button">
                  {tab === 'repo' ? 'Cari di repositori' : 'Cari di sumber'}
                </button>
              </div>
            )}

            {err && (
              <div className="note bad">
                <div>{err}</div>
              </div>
            )}

            {empty && (
              <div className="card empty">
                <b>Tidak ada media yang cocok.</b>
                <span>
                  {tab === 'repo'
                    ? 'Lanjutkan pencarian ke sumber eksternal yang diperbolehkan (UC-10 A1).'
                    : 'Coba hasilkan gambar dengan AI (UC-09 A1).'}
                </span>
                <button className="btn" onClick={() => setTab(tab === 'repo' ? 'ext' : 'ai')} type="button">
                  {tab === 'repo' ? 'Cari di sumber diperbolehkan' : 'Hasilkan dengan AI'}
                </button>
              </div>
            )}

            {cands.length > 0 && (
              <div className="grid g3">
                {cands.map((c, i) => (
                  <div key={i} className={`cand ${c.ok ? '' : 'disabled'}`}>
                    <img src={c.img} alt={c.title} />
                    <b className="small">{c.title}</b>
                    <span className="small muted">{c.source}</span>
                    <span className="small">
                      {c.ok ? (
                        <span className="chip c-ok">Lisensi: {c.rights}</span>
                      ) : (
                        <span className="chip c-mark">Lisensi belum jelas</span>
                      )}
                    </span>
                    {c.ai && <span className="small muted">Hasil AI, periksa ketepatan label sebelum dipakai (UC-11 A3).</span>}
                    <button className={`btn sm ${c.ok ? 'primary' : ''}`} onClick={() => handleUse(c)} disabled={!c.ok} type="button">
                      {c.ok ? 'Setujui dan gunakan' : 'Tidak dapat dipilih'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {uploadSteps.length > 0 && (
              <div className="card stack">
                <h3>Menyimpan ke repositori (UC-12)</h3>
                {uploadSteps.map((u, idx) => (
                  <div key={idx} className="small">
                    {u}
                  </div>
                ))}
                {uploadFail && pendingCand && (
                  <div className="row">
                    <button className="btn primary" onClick={() => handleUse(pendingCand)} type="button">
                      Coba simpan lagi
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}

/* S-08 Repositori Media */
function RepoPage({
  data,
  setData,
  addLog,
  showToast,
}: {
  data: ReturnType<typeof initialSeed>
  setData: React.Dispatch<React.SetStateAction<ReturnType<typeof initialSeed>>>
  addLog: (uc: string, msg: string) => void
  showToast: (msg: string) => void
}) {
  const used = (id: string) => data.questions.filter((q) => q.mediaIds.includes(id) && q.status !== 'Rejected').length

  function handleArchive(id: string) {
    setData((prev) => ({
      ...prev,
      media: prev.media.map((m) => (m.id === id ? { ...m, status: 'Archived' } : m)),
    }))
    addLog('UC-12', `${id} diarsipkan`)
    showToast('Media diarsipkan')
  }

  return (
    <>
      <div className="head">
        <div>
          <h1>Repositori media</h1>
          <p className="muted">Media tersimpan di repositori terintegrasi. Media yang dipakai soal aktif tidak dapat diarsipkan.</p>
        </div>
      </div>

      <div className="grid g4">
        {data.media.map((m) => {
          const uCount = used(m.id)
          return (
            <div key={m.id} className="cand">
              <img src={m.img || m.filePath} alt={m.title} />
              <b className="small">{m.title}</b>
              <span className="small muted mono">
                {m.id} · {m.source}
              </span>
              <span className="row">
                <span className={`chip ${MS_CLS[m.status]}`}>{MS_LABEL[m.status]}</span>
                <span className="small muted">dipakai {uCount} soal</span>
              </span>
              {m.status !== 'Archived' && (
                <button
                  className="btn sm"
                  onClick={() => handleArchive(m.id)}
                  disabled={uCount > 0}
                  title={uCount > 0 ? 'Masih dipakai soal aktif' : ''}
                  type="button"
                >
                  Arsipkan
                </button>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}

/* S-09 Paket Soal */
function PackagesPage({
  data,
  setData,
  addLog,
}: {
  data: ReturnType<typeof initialSeed>
  setData: React.Dispatch<React.SetStateAction<ReturnType<typeof initialSeed>>>
  addLog: (uc: string, msg: string) => void
}) {
  const navigate = useNavigate()

  function handleNewPkg() {
    const pId = 'P-' + data.seq.p
    const newPkg: PackageItem = {
      id: pId,
      title: 'Paket baru',
      type: 'Latihan',
      status: 'Draft',
      price: 0,
      qids: [],
      createdAt: '2026-10-27',
    }
    setData((prev) => ({
      ...prev,
      packages: [newPkg, ...prev.packages],
      seq: { ...prev.seq, p: prev.seq.p + 1 },
    }))
    addLog('UC-13', `${pId} dibuat (Draf)`)
    navigate(`/packages/${pId}`)
  }

  return (
    <>
      <div className="head">
        <div>
          <h1>Paket soal</h1>
          <p className="muted">Paket hanya berisi soal tervalidasi. Paket Siap Digunakan tersedia di aplikasi kuis.</p>
        </div>
        <div className="actions">
          <button className="btn primary" onClick={handleNewPkg} type="button">
            Paket baru
          </button>
        </div>
      </div>

      <div className="tw">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Judul</th>
              <th>Jenis</th>
              <th>Soal</th>
              <th>Harga</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.packages.map((p) => (
              <tr key={p.id}>
                <td className="mono">{p.id}</td>
                <td>{p.title}</td>
                <td>{p.type}</td>
                <td className="num">{p.qids.length}</td>
                <td className="num">{p.price ? rp(p.price) : 'Gratis'}</td>
                <td>
                  <span className={`chip ${p.status === 'Ready' ? 'c-ok' : 'c-idle'}`}>
                    {p.status === 'Ready' ? 'Siap digunakan' : 'Draf'}
                  </span>
                </td>
                <td>
                  <Link className="btn sm" to={`/packages/${p.id}`}>
                    Buka
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

/* S-10 Susun Paket / Builder */
function PackageBuilderPage({
  data,
  setData,
  addLog,
  showToast,
}: {
  data: ReturnType<typeof initialSeed>
  setData: React.Dispatch<React.SetStateAction<ReturnType<typeof initialSeed>>>
  addLog: (uc: string, msg: string) => void
  showToast: (msg: string) => void
}) {
  const { id } = useParams()
  const navigate = useNavigate()
  const p = data.packages.find((x) => x.id === id) || data.packages[0]

  const [title, setTitle] = useState(p.title)
  const [type, setType] = useState(p.type)
  const [price, setPrice] = useState(p.price)
  const [filterSubj, setFilterSubj] = useState('')
  const [pkgIssues, setPkgIssues] = useState<string[] | null>(null)

  const allQuestions = useMemo(() => {
    return data.questions.filter((q) => !filterSubj || q.subject === filterSubj)
  }, [data.questions, filterSubj])

  function handleToggleQ(qid: string) {
    const nextQids = p.qids.includes(qid) ? p.qids.filter((x) => x !== qid) : [...p.qids, qid]
    setData((prev) => ({
      ...prev,
      packages: prev.packages.map((item) =>
        item.id === p.id
          ? {
              ...item,
              qids: nextQids,
              status: item.status === 'Ready' ? 'Draft' : item.status,
            }
          : item
      ),
    }))
    setPkgIssues(null)
  }

  function handleSaveDraft() {
    setData((prev) => ({
      ...prev,
      packages: prev.packages.map((item) => (item.id === p.id ? { ...item, title, type, price: +price } : item)),
    }))
    showToast('Draf paket disimpan')
  }

  function handleValidateReady(e: React.FormEvent) {
    e.preventDefault()
    const v: string[] = []
    if (!title.trim()) v.push('Judul paket wajib diisi')
    if (!p.qids.length) v.push('Pilih sekurang-kurangnya satu soal (UC-13 A1)')

    p.qids.forEach((qid) => {
      const q = data.questions.find((x) => x.id === qid)
      if (q) {
        if (q.status !== 'Accepted') v.push(`${qid} belum tervalidasi (UC-13 A2)`)
        if (q.mediaReq === 'Required' || q.mediaReq === 'NeedsCheck') v.push(`${qid}: kebutuhan media belum terpenuhi`)
      }
    })

    setPkgIssues(v)
    if (!v.length) {
      setData((prev) => ({
        ...prev,
        packages: prev.packages.map((item) => (item.id === p.id ? { ...item, title, type, price: +price, status: 'Ready' } : item)),
      }))
      addLog('UC-13', `${p.id} lolos validasi → Siap Digunakan`)
      showToast('Paket siap digunakan')
    } else {
      addLog('UC-13', `${p.id} gagal validasi: ${v.length} kekurangan (A3)`)
    }
  }

  return (
    <>
      <div className="head">
        <div>
          <button className="btn sm ghost" onClick={() => navigate('/packages')} type="button">
            ← Paket soal
          </button>
          <h1>
            Susun paket <span className="mono">{p.id}</span>
          </h1>
        </div>
        <div>
          <span className={`chip ${p.status === 'Ready' ? 'c-ok' : 'c-idle'}`}>
            {p.status === 'Ready' ? 'Siap digunakan' : 'Draf'}
          </span>
        </div>
      </div>

      {pkgIssues && (
        pkgIssues.length ? (
          <div className="note bad">
            <div>
              <b>Paket belum dapat ditandai siap.</b>
              <br />
              {pkgIssues.map((iss, i) => (
                <span key={i}>
                  {iss}
                  <br />
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="note ok">
            <div>
              <b>Paket lolos validasi dan berstatus Siap Digunakan.</b> Paket kini tersedia untuk aplikasi kuis
              {price ? ' dan katalog pembelian' : ''}.
            </div>
          </div>
        )
      )}

      <div className="split">
        <div className="card stack">
          <div className="row between">
            <h3>Pilih soal</h3>
            <div className="row">
              <select value={filterSubj} onChange={(e) => setFilterSubj(e.target.value)} aria-label="Saring mata pelajaran">
                <option value="">Semua mapel</option>
                {Object.entries(SUBJECTS).map(([k, x]) => (
                  <option key={k} value={k}>
                    {x}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="stack" style={{ maxHeight: 520, overflow: 'auto', paddingRight: 4 }}>
            {allQuestions.map((q) => {
              const ok = q.status === 'Accepted'
              const sel = p.qids.includes(q.id)
              return (
                <label
                  key={q.id}
                  className={`check card ${ok ? '' : 'flat'}`}
                  style={{ padding: 10, opacity: ok ? 1 : 0.65 }}
                >
                  <input
                    type="checkbox"
                    checked={sel}
                    disabled={!ok && !sel}
                    onChange={() => handleToggleQ(q.id)}
                  />
                  <span style={{ minWidth: 0 }}>
                    <span className="mono">{q.id}</span> {q.text.slice(0, 80)}…
                    <br />
                    <span className="row">
                      <span className={`chip ${QS_CLS[q.status]}`}>{QS_LABEL[q.status]}</span>
                      <span className={`chip ${MR_CLS[q.mediaReq]}`}>{MR_LABEL[q.mediaReq]}</span>
                      {!ok && <span className="small muted">Hanya soal tervalidasi yang dapat dipilih (UC-13 A2)</span>}
                    </span>
                  </span>
                </label>
              )
            })}
          </div>
        </div>

        <form className="card stack" onSubmit={handleValidateReady} noValidate>
          <label className="f">
            Judul paket
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="f">
            Jenis paket
            <select value={type} onChange={(e) => setType(e.target.value)}>
              {PKG_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="f">
            Harga (kosongkan jika gratis)
            <input type="number" min={0} step={1000} value={price || ''} onChange={(e) => setPrice(+e.target.value)} />
          </label>
          <div className="small">
            <b>{p.qids.length}</b> soal dipilih: <span className="mono">{p.qids.join(', ') || '-'}</span>
          </div>
          <div className="row">
            <button className="btn" onClick={handleSaveDraft} type="button">
              Simpan draf
            </button>
            <button className="btn primary" type="submit">
              Validasi dan tandai siap
            </button>
          </div>
          {p.status === 'Ready' && (
            <button
              className="btn sm ghost"
              onClick={() => {
                setData((prev) => ({
                  ...prev,
                  packages: prev.packages.map((item) => (item.id === p.id ? { ...item, status: 'Draft' } : item)),
                }))
                setPkgIssues(null)
                addLog('UC-13', `${p.id} dibuka kembali → Draf`)
              }}
              type="button"
            >
              Buka kembali sebagai draf
            </button>
          )}
        </form>
      </div>
    </>
  )
}

/* S-11 Kuis Saya */
function QuizListPage({
  data,
  onStartQuiz,
}: {
  data: ReturnType<typeof initialSeed>
  onStartQuiz: (pid: string) => void
}) {
  const ready = data.packages.filter((p) => p.status === 'Ready')

  function hasAccess(pid: string) {
    const p = data.packages.find((x) => x.id === pid)
    if (!p || !p.price) return true
    return data.access.some((a) => a.packageId === pid && a.studentId === 'U-11' && a.status === 'Active')
  }

  return (
    <>
      <div className="note info">
        <div>
          Layar ini mensimulasikan <b>Aplikasi Kuis eksternal</b>. Aplikasi meminta paket tervalidasi dari sistem lalu mengirim hasil kembali (UC-14, UC-15).
        </div>
      </div>

      <div className="quizapp">
        <div className="qhead">
          <b>Kuis Antiremed</b>
          <span className="small">Dimas · SMP Kelas 8</span>
        </div>
        <div className="qbody">
          {ready.length ? (
            ready.map((p) => {
              const access = hasAccess(p.id)
              return (
                <div key={p.id} className="card stack">
                  <div className="row between">
                    <b>{p.title}</b>
                    {p.price ? (
                      <span className={`chip ${access ? 'c-ok' : 'c-mark'}`}>
                        {access ? 'Akses aktif' : 'Perlu dibeli'}
                      </span>
                    ) : (
                      <span className="chip c-acc">Gratis</span>
                    )}
                  </div>
                  <span className="small muted">
                    {p.type} · {p.qids.length} soal
                  </span>
                  {access ? (
                    <button className="btn primary" onClick={() => onStartQuiz(p.id)} type="button">
                      Mulai
                    </button>
                  ) : (
                    <span className="small muted">Orang tua dapat membeli paket ini di katalog.</span>
                  )}
                </div>
              )
            })
          ) : (
            <div className="empty">
              <b>Belum ada kuis.</b>
              <span>Paket akan muncul setelah pengajar menandainya siap (UC-14 A1).</span>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

/* S-12 Kerjakan Kuis */
function QuizTakerPage({
  attempt,
  setAttempt,
  data,
  setData,
  sim,
  addLog,
  onDone,
}: {
  attempt: ActiveAttemptState | null
  setAttempt: React.Dispatch<React.SetStateAction<ActiveAttemptState | null>>
  data: ReturnType<typeof initialSeed>
  setData: React.Dispatch<React.SetStateAction<ReturnType<typeof initialSeed>>>
  sim: SimulationSettings
  addLog: (uc: string, msg: string) => void
  onDone: () => void
}) {
  if (!attempt) {
    return (
      <div className="empty">
        Pilih kuis.
        <Link className="btn" to="/quiz">
          Kuis saya
        </Link>
      </div>
    )
  }

  const p = data.packages.find((x) => x.id === attempt.pid)!
  const i = attempt.i
  const qid = p.qids[i]
  const q = data.questions.find((x) => x.id === qid)!
  const n = p.qids.length

  const media = q.mediaIds.map((mid) => data.media.find((m) => m.id === mid)).filter(Boolean) as MediaItem[]

  function selectAnswer(label: string) {
    setAttempt((prev) => (prev ? {
      ...prev,
      ans: { ...prev.ans, [q.id]: label },
    } : null))
  }

  async function handleSubmit() {
    if (!attempt) return
    setAttempt((prev) => (prev ? { ...prev, sending: true, err: false } : null))
    await wait(800)

    if (sim.submit === 'fail') {
      setAttempt((prev) => (prev ? { ...prev, sending: false, err: true } : null))
      addLog('UC-14', 'Pengiriman jawaban dari aplikasi kuis gagal (A2)')
      return
    }

    let correct = 0
    p.qids.forEach((questionId) => {
      const qItem = data.questions.find((x) => x.id === questionId)
      if (qItem) {
        const correctOpt = qItem.options.find((o) => o.isCorrect)
        if (correctOpt && attempt.ans[questionId] === correctOpt.label) correct++
      }
    })

    const atId = 'AT-' + data.seq.a
    const score = Math.round((correct / p.qids.length) * 100)
    const atStatus = sim.match === 'match' ? 'Stored' : 'Unmatched'

    const newAttempt: AttemptItem = {
      id: atId,
      pid: p.id,
      studentId: 'U-11',
      total: p.qids.length,
      correct,
      score,
      ans: { ...attempt.ans },
      at: now(),
      status: atStatus,
    }

    addLog('UC-14', `Aplikasi kuis mengirim jawaban ${atId} untuk ${p.id}`)

    let nextResult: ResultItem | null = null
    const newDeliveries: DeliveryItem[] = []
    let nextSeqD = data.seq.d

    if (atStatus === 'Stored') {
      addLog('UC-15', `${atId} tersimpan: skor ${score}`)
      const rId = 'LR-' + data.seq.r
      const st = data.students.find((s) => s.id === 'U-11')!
      nextResult = {
        id: rId,
        attId: atId,
        studentId: st.id,
        pid: p.id,
        score,
        summary: `${st.name.split(' ')[0]} menyelesaikan ${p.title} dengan skor ${score} (${correct}/${p.qids.length} benar).`,
        at: now(),
      }
      addLog('UC-16', `${rId} disusun dari ${atId}`)

      // Deliveries
      // To student
      let stContact = st.phone ? 'WhatsApp' : st.email ? 'Email' : ''
      if (sim.stuContact === 'missing') stContact = ''
      const dlStStatus = !stContact ? 'Held' : sim.channel === 'sent' ? 'Sent' : 'Failed'
      const dlStReason = !stContact ? 'Data kontak tidak tersedia' : sim.channel === 'sent' ? '' : 'Layanan pesan mengembalikan galat'
      newDeliveries.push({
        id: 'DL-' + nextSeqD++,
        rid: rId,
        kind: 'student',
        to: st.id,
        toName: st.name,
        channel: stContact || '-',
        status: dlStStatus,
        reason: dlStReason,
        at: now(),
      })
      addLog('UC-17', `DL-${nextSeqD - 1} ${st.name}: ${DL_LABEL[dlStStatus]}${dlStReason ? ' (' + dlStReason + ')' : ''}`)

      // To parent
      const par = st.parents.map((parId) => data.parents.find((x) => x.id === parId)).filter(Boolean) as ParentItem[]
      if (!par.length || sim.parentLink === 'unverified') {
        newDeliveries.push({
          id: 'DL-' + nextSeqD++,
          rid: rId,
          kind: 'parent',
          to: null,
          toName: 'orang tua',
          channel: '-',
          status: 'Held',
          reason: 'Relasi orang tua dan siswa belum terverifikasi',
          at: now(),
        })
        addLog('UC-18', `DL-${nextSeqD - 1} orang tua: Ditahan (Relasi belum terverifikasi)`)
      } else {
        par.forEach((pp) => {
          const pContact = pp.phone ? 'WhatsApp' : pp.email ? 'Email' : ''
          const dlPStatus = !pContact ? 'Held' : sim.channel === 'sent' ? 'Sent' : 'Failed'
          const dlPReason = !pContact ? 'Data kontak tidak tersedia' : sim.channel === 'sent' ? '' : 'Layanan pesan mengembalikan galat'
          newDeliveries.push({
            id: 'DL-' + nextSeqD++,
            rid: rId,
            kind: 'parent',
            to: pp.id,
            toName: pp.name,
            channel: pContact || '-',
            status: dlPStatus,
            reason: dlPReason,
            at: now(),
          })
          addLog('UC-18', `DL-${nextSeqD - 1} ${pp.name}: ${DL_LABEL[dlPStatus]}${dlPReason ? ' (' + dlPReason + ')' : ''}`)
        })
      }
    } else {
      addLog('UC-15', `${atId} tidak cocok dengan siswa/paket, ditahan untuk diperiksa`)
    }

    setData((prev) => ({
      ...prev,
      attempts: [newAttempt, ...prev.attempts],
      results: nextResult ? [nextResult, ...prev.results] : prev.results,
      deliveries: [...newDeliveries, ...prev.deliveries],
      seq: {
        ...prev.seq,
        a: prev.seq.a + 1,
        r: nextResult ? prev.seq.r + 1 : prev.seq.r,
        d: nextSeqD,
      },
    }))

    onDone()
  }

  return (
    <div className="quizapp">
      <div className="qhead">
        <b>{p.title}</b>
        <span className="small mono">
          {i + 1}/{n}
        </span>
      </div>
      <div className="qbody">
        <div className="prog">
          <i style={{ width: `${((i + 1) / n) * 100}%` }} />
        </div>

        <p className="q-text">{q.text}</p>
        {media.map((m) => (
          <img
            key={m.id}
            src={m.img || m.filePath}
            alt={m.title}
            style={{ maxWidth: 260, border: '1px solid var(--line)', borderRadius: 6 }}
          />
        ))}

        {q.options.map((o) => (
          <button
            key={o.label}
            className={`qopt ${attempt.ans[q.id] === o.label ? 'sel' : ''}`}
            onClick={() => selectAnswer(o.label)}
            type="button"
          >
            <span className="mono">{o.label}</span>
            <span>{o.text}</span>
          </button>
        ))}

        {attempt.err && (
          <div className="note bad">
            <div>
              <b>Jawaban gagal terkirim.</b> Koneksi ke sistem terputus. Jawaban Anda masih tersimpan di perangkat; kirim ulang (UC-14 A2).
            </div>
          </div>
        )}

        <div className="row between">
          <button
            className="btn"
            onClick={() => setAttempt((prev) => (prev ? { ...prev, i: prev.i - 1 } : null))}
            disabled={i === 0}
            type="button"
          >
            Sebelumnya
          </button>

          {i < n - 1 ? (
            <button
              className="btn primary"
              onClick={() => setAttempt((prev) => (prev ? { ...prev, i: prev.i + 1 } : null))}
              type="button"
            >
              Berikutnya
            </button>
          ) : (
            <button
              className={`btn primary ${attempt.sending ? 'loading' : ''}`}
              onClick={handleSubmit}
              disabled={attempt.sending}
              type="button"
            >
              {attempt.err ? 'Kirim ulang jawaban' : 'Kirim jawaban'}
            </button>
          )}
        </div>

        <span className="small muted">
          {Object.keys(attempt.ans).length} dari {n} soal terjawab. Soal tidak dijawab dihitung salah.
        </span>
      </div>
    </div>
  )
}

/* S-13 Hasil Kuis Selesai */
function QuizDonePage({ data }: { data: ReturnType<typeof initialSeed> }) {
  const at = data.attempts[0]

  if (!at) {
    return (
      <div className="empty">
        Belum ada jawaban yang dikirim.
        <Link className="btn" to="/quiz">
          Kuis saya
        </Link>
      </div>
    )
  }

  const p = data.packages.find((x) => x.id === at.pid)

  return (
    <div className="quizapp">
      <div className="qhead">
        <b>{p ? p.title : 'Kuis'}</b>
        <span className="small">Selesai</span>
      </div>
      <div className="qbody">
        {at.status === 'Stored' ? (
          <>
            <div className="note ok">
              <div>
                <b>Hasil tersimpan di sistem (UC-15).</b>
              </div>
            </div>
            <div className="price">
              {at.score}
              <span className="small muted"> / 100</span>
            </div>
            <p className="small">
              {at.correct} dari {at.total} jawaban benar.
            </p>
          </>
        ) : (
          <div className="note warn">
            <div>
              <b>Jawaban diterima, tetapi belum dapat dikaitkan dengan akun Anda.</b> Sistem tidak menyimpan hasil ke data yang salah dan mencatat masalah ini untuk diperiksa pengajar (UC-15 A2).
            </div>
          </div>
        )}

        <Link className="btn" to="/quiz">
          Kembali ke daftar kuis
        </Link>
      </div>
    </div>
  )
}

/* S-14 Hasil & Distribusi */
function ResultsPage({
  data,
  setData,
  sim,
  addLog,
  showToast,
}: {
  data: ReturnType<typeof initialSeed>
  setData: React.Dispatch<React.SetStateAction<ReturnType<typeof initialSeed>>>
  sim: SimulationSettings
  addLog: (uc: string, msg: string) => void
  showToast: (msg: string, bad?: boolean) => void
}) {
  function handleResend(dId: string) {
    const d = data.deliveries.find((x) => x.id === dId)
    if (!d) return

    if (sim.channel === 'sent') {
      d.status = 'Sent'
      d.reason = 'Terkirim pada pengiriman ulang'
      showToast('Pesan terkirim')
    } else {
      showToast('Pengiriman ulang gagal. Status tetap Gagal.', true)
    }

    addLog(d.kind === 'student' ? 'UC-17' : 'UC-18', `${d.id} kirim ulang: ${DL_LABEL[d.status]}`)
    setData({ ...data })
  }

  return (
    <>
      <div className="head">
        <div>
          <h1>Hasil dan distribusi</h1>
          <p className="muted">Ringkasan disusun otomatis setelah hasil tersimpan (UC-16), lalu dikirim ke siswa dan orang tua (UC-17, UC-18).</p>
        </div>
      </div>

      {data.results.length ? (
        data.results.map((r) => {
          const st = data.students.find((s) => s.id === r.studentId)
          const p = data.packages.find((pkg) => pkg.id === r.pid)
          const dl = data.deliveries.filter((d) => d.rid === r.id)
          return (
            <div key={r.id} className="card stack">
              <div className="row between">
                <div>
                  <b>{st ? st.name : 'Siswa'}</b> · {p ? p.title : 'Paket'} <span className="mono muted">{r.id}</span>
                </div>
                <div className="price" style={{ fontSize: '1.2rem' }}>
                  {r.score}
                </div>
              </div>
              <p className="small">{r.summary}</p>

              <div className="tw">
                <table>
                  <thead>
                    <tr>
                      <th>Penerima</th>
                      <th>Kanal</th>
                      <th>Status</th>
                      <th>Keterangan</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {dl.map((d) => (
                      <tr key={d.id}>
                        <td>
                          {d.toName} <span className="muted small">({d.kind === 'student' ? 'siswa' : 'orang tua'})</span>
                        </td>
                        <td>{d.channel}</td>
                        <td>
                          <span className={`chip ${DL_CLS[d.status]}`}>{DL_LABEL[d.status]}</span>
                        </td>
                        <td className="small">{d.reason || '-'}</td>
                        <td>
                          {d.status === 'Failed' && (
                            <button className="btn sm" onClick={() => handleResend(d.id)} type="button">
                              Kirim ulang
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })
      ) : (
        <div className="card empty">
          <b>Belum ada hasil pembelajaran.</b>
          <span>Hasil muncul setelah siswa mengirim jawaban dan sistem menyimpannya (UC-16 A1). Masuk sebagai Siswa untuk mengerjakan kuis.</span>
        </div>
      )}

      {data.attempts.some((a) => a.status !== 'Stored') && (
        <div className="card stack">
          <h3>Hasil yang belum dapat dikaitkan (UC-15 A2)</h3>
          {data.attempts.filter((a) => a.status !== 'Stored').map((a) => (
            <div key={a.id} className="small">
              <span className="mono">{a.id}</span> paket {a.pid} · {a.at} <span className="chip c-mark">Ditahan</span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

/* S-15 Pesan Diterima */
function MessagesPage({ data }: { data: ReturnType<typeof initialSeed> }) {
  const mine = data.deliveries.filter((d) => d.to === 'U-21' && d.status === 'Sent')

  return (
    <>
      <div className="head">
        <div>
          <h1>Pesan diterima</h1>
          <p className="muted">Pratinjau pesan WhatsApp yang diterima Ibu Sari (orang tua Dimas). Pengiriman disimulasikan.</p>
        </div>
      </div>

      {mine.length ? (
        <div className="wa">
          {mine.map((d) => {
            const r = data.results.find((x) => x.id === d.rid)
            return (
              <React.Fragment key={d.id}>
                <div className="bubble">
                  Halo Ibu Sari, berikut hasil belajar dari Bimbel Antiremed:
                  {'\n'}
                  {r ? r.summary : ''}
                  {'\n'}
                  Pesan ini dikirim karena Ibu terdaftar sebagai wali. Balas STOP untuk berhenti.
                </div>
                <span className="small muted mono">
                  {d.at} · {d.channel}
                </span>
              </React.Fragment>
            )
          })}
        </div>
      ) : (
        <div className="card empty">
          <b>Belum ada pesan.</b>
          <span>Pesan muncul setelah Dimas menyelesaikan kuis dan pengiriman ke orang tua berhasil.</span>
        </div>
      )}
    </>
  )
}

/* S-16 Katalog Paket */
function CatalogPage({
  data,
  onBuy,
  onViewPay,
}: {
  data: ReturnType<typeof initialSeed>
  onBuy: (pid: string) => void
  onViewPay: (id: string) => void
}) {
  const paid = data.packages.filter((p) => p.status === 'Ready' && p.price > 0)
  const mine = data.payments.filter((x) => x.userId === 'U-21')

  return (
    <>
      <div className="head">
        <div>
          <h1>Katalog paket</h1>
          <p className="muted">Pembelian akses paket untuk anak Anda.</p>
        </div>
      </div>

      {paid.length ? (
        <div className="grid g3">
          {paid.map((p) => {
            const own = data.access.some((a) => a.packageId === p.id && a.studentId === 'U-11' && a.status === 'Active')
            return (
              <div key={p.id} className="card stack">
                <b>{p.title}</b>
                <span className="small muted">
                  {p.type} · {p.qids.length} soal
                </span>
                <span className="price">{rp(p.price)}</span>
                {own ? (
                  <span className="chip c-ok">Akses Dimas sudah aktif</span>
                ) : (
                  <button className="btn primary" onClick={() => onBuy(p.id)} type="button">
                    Beli untuk Dimas
                  </button>
                )}
                {own && (
                  <button className="btn sm ghost" onClick={() => onBuy(p.id)} type="button">
                    Beli lagi (uji skenario)
                  </button>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="card empty">
          <b>Belum ada paket berbayar.</b>
          <span>Pengajar perlu menandai paket berharga sebagai Siap Digunakan.</span>
        </div>
      )}

      <div className="card stack">
        <h3>Riwayat pembayaran</h3>
        {mine.length ? (
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Paket</th>
                  <th>Jumlah</th>
                  <th>Status</th>
                  <th>Waktu</th>
                </tr>
              </thead>
              <tbody>
                {mine.map((x) => {
                  const pkg = data.packages.find((p) => p.id === x.packageId)
                  return (
                    <tr key={x.id} className="click" onClick={() => onViewPay(x.id)}>
                      <td className="mono">{x.id}</td>
                      <td>{pkg ? pkg.title : x.packageId}</td>
                      <td className="num">{rp(x.amount)}</td>
                      <td>
                        <span className={`chip ${PAY_CLS[x.status]}`}>{PAY_LABEL[x.status]}</span>
                      </td>
                      <td className="mono small">{x.createdAt}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <span className="muted small">Belum ada transaksi.</span>
        )}
      </div>
    </>
  )
}

/* S-17 Checkout */
function CheckoutPage({
  pid,
  data,
  setData,
  sim,
  addLog,
  onCreated,
}: {
  pid: string
  data: ReturnType<typeof initialSeed>
  setData: React.Dispatch<React.SetStateAction<ReturnType<typeof initialSeed>>>
  sim: SimulationSettings
  addLog: (uc: string, msg: string) => void
  onCreated: (payId: string) => void
}) {
  const navigate = useNavigate()
  const p = data.packages.find((x) => x.id === pid) || data.packages[0]

  const [guardian, setGuardian] = useState(false)
  const [error, setError] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!guardian) {
      setError('Centang pernyataan wali untuk melanjutkan')
      return
    }

    const payId = 'PAY-0' + data.seq.pay
    const newPay: PaymentItem = {
      id: payId,
      userId: 'U-21',
      studentId: 'U-11',
      packageId: p.id,
      amount: p.price,
      status: 'Created',
      createdAt: now(),
      expiresAtMs: Date.now() + 15 * 60000,
      ref: null,
    }

    addLog('UC-19', `${payId} dibuat (Created) untuk ${p.id}, ${rp(p.price)}; meminta QRIS`)

    if (sim.qris === 'rejected') {
      newPay.status = 'Failed'
      newPay.reason = 'rejected'
      addLog('UC-20', `Penyedia REJECTED permintaan ${payId}`)
      addLog('UC-19', `${payId} → Failed (permintaan ditolak)`)
    } else {
      newPay.ref = 'QR-' + Math.random().toString(16).slice(2, 6).toUpperCase()
      addLog('UC-20', `Penyedia memvalidasi ${payId} dan menerbitkan QRIS ${newPay.ref}`)
    }

    setData((prev) => ({
      ...prev,
      payments: [newPay, ...prev.payments],
      seq: { ...prev.seq, pay: prev.seq.pay + 1 },
    }))

    onCreated(payId)
  }

  return (
    <>
      <div className="head">
        <div>
          <button className="btn sm ghost" onClick={() => navigate('/catalog')} type="button">
            ← Katalog
          </button>
          <h1>Checkout</h1>
        </div>
      </div>

      <form className="card stack" onSubmit={handleSubmit} noValidate style={{ maxWidth: 560 }}>
        <div className="row between">
          <div>
            <b>{p.title}</b>
            <div className="small muted">
              {p.type} · {p.qids.length} soal
            </div>
          </div>
          <span className="price">{rp(p.price)}</span>
        </div>
        <hr />

        <label className="f">
          Untuk siswa
          <select defaultValue="U-11">
            <option value="U-11">Dimas Pratama (SMP Kelas 8)</option>
          </select>
        </label>

        <fieldset style={{ border: 0, padding: 0, margin: 0 }} className="stack">
          <legend className="small">
            <b>Metode pembayaran</b>
          </legend>
          <label className="check">
            <input type="radio" name="coMethod" defaultChecked /> QRIS (semua e-wallet dan mobile banking)
          </label>
        </fieldset>

        <label className={`check ${error ? 'invalid' : ''}`}>
          <input type="checkbox" checked={guardian} onChange={(e) => setGuardian(e.target.checked)} />
          Saya orang tua/wali Dimas dan menyetujui pemrosesan data belajarnya sesuai kebijakan privasi (NFR-11).
        </label>
        {error && <span className="err">{error}</span>}

        <div className="row between">
          <span className="small muted">Status pembayaran hanya berubah setelah dikonfirmasi penyedia.</span>
          <button className="btn primary" type="submit">
            Bayar dengan QRIS
          </button>
        </div>
      </form>
    </>
  )
}

/* S-18 Pembayaran QRIS */
function QrisPage({
  payId,
  data,
  setData,
  addLog,
  showToast,
  setModal,
  onRetryBuy,
}: {
  payId: string
  data: ReturnType<typeof initialSeed>
  setData: React.Dispatch<React.SetStateAction<ReturnType<typeof initialSeed>>>
  addLog: (uc: string, msg: string) => void
  showToast: (msg: string) => void
  setModal: React.Dispatch<React.SetStateAction<React.ReactNode | null>>
  onRetryBuy: (pid: string) => void
}) {
  const navigate = useNavigate()
  const x = data.payments.find((y) => y.id === payId) || data.payments[0]
  const p = data.packages.find((pkg) => pkg.id === x.packageId)!
  const cf = data.confirmations.filter((c) => c.paymentId === x.id)

  const [timeLeft, setTimeLeft] = useState(() => Math.max(0, x.expiresAtMs - Date.now()))

  useEffect(() => {
    if (x.status !== 'Created') return
    const timer = setInterval(() => {
      const remaining = Math.max(0, x.expiresAtMs - Date.now())
      setTimeLeft(remaining)
      if (remaining <= 0) {
        x.status = 'Failed'
        x.reason = 'expired'
        addLog('UC-19', `${x.id} kedaluwarsa tanpa pembayaran → Failed`)
        setData((prev) => ({ ...prev }))
        clearInterval(timer)
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [x, addLog, setData])

  const m = Math.floor(timeLeft / 60000)
  const s = Math.floor((timeLeft % 60000) / 1000)
  const timeFormatted = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`

  function handleCancel() {
    setModal(
      <div className="scrim">
        <div className="dialog" role="dialog" aria-modal="true">
          <h2>Batalkan pembayaran?</h2>
          <p>Transaksi {x.id} akan dibatalkan. Jangan batalkan jika Anda sudah membayar.</p>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => setModal(null)} type="button">
              Kembali
            </button>
            <button
              className="btn danger"
              onClick={() => {
                setModal(null)
                if (x.status === 'Created') {
                  x.status = 'Cancelled'
                  addLog('UC-19', `${x.id} dibatalkan pengguna → Cancelled`)
                  setData((prev) => ({ ...prev }))
                }
              }}
              type="button"
            >
              Batalkan transaksi
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="head">
        <div>
          <button className="btn sm ghost" onClick={() => navigate('/catalog')} type="button">
            ← Katalog
          </button>
          <h1>
            Pembayaran <span className="mono">{x.id}</span>
          </h1>
          <p className="muted">{p ? p.title : ''} untuk Dimas</p>
        </div>
        <div>
          <span className={`chip ${PAY_CLS[x.status]}`}>{PAY_LABEL[x.status]}</span>
        </div>
      </div>

      <div className="card stack">
        {x.status === 'Created' ? (
          <div className="row" style={{ alignItems: 'flex-start', gap: 20 }}>
            <div dangerouslySetInnerHTML={{ __html: qrSvg(x.id) }} />
            <div className="stack" style={{ flex: 1, minWidth: 200 }}>
              <span className="price">{rp(x.amount)}</span>
              <span className="small">Pindai kode dengan aplikasi e-wallet atau mobile banking.</span>
              <span className="small">
                Berlaku <b className="mono">{timeFormatted}</b>
              </span>
              <div className="note info">
                <div>Memindai kode tidak langsung mengubah status. Halaman ini diperbarui otomatis setelah penyedia mengonfirmasi pembayaran (UC-21).</div>
              </div>
              <div className="row">
                <button
                  className="btn"
                  onClick={() => {
                    addLog('UC-21', `Cek ulang status ${x.id} ke API penyedia: ${PAY_LABEL[x.status]}`)
                    showToast('Status terbaru: ' + PAY_LABEL[x.status])
                  }}
                  type="button"
                >
                  Cek status sekarang
                </button>
                <button className="btn danger" onClick={handleCancel} type="button">
                  Batalkan
                </button>
              </div>
              <span className="small muted">QR simulasi, tidak dapat dipindai. Kirim status penyedia lewat Panel simulasi → Layanan QRIS (UC-20).</span>
            </div>
          </div>
        ) : x.status === 'Pending' ? (
          <>
            <div className="note warn">
              <div>
                <b>Pembayaran sedang diproses penyedia.</b> Akses paket belum aktif. Sistem memeriksa ulang status secara berkala (UC-21 A3).
              </div>
            </div>
            <div className="row">
              <button
                className="btn"
                onClick={() => {
                  addLog('UC-21', `Cek ulang status ${x.id} ke API penyedia: ${PAY_LABEL[x.status]}`)
                  showToast('Status terbaru: ' + PAY_LABEL[x.status])
                }}
                type="button"
              >
                Cek status sekarang
              </button>
            </div>
          </>
        ) : x.status === 'Paid' ? (
          <>
            <div className="note ok">
              <div>
                <b>Pembayaran berhasil dan terverifikasi.</b> Akses {p ? p.title : ''} untuk Dimas sudah aktif.
              </div>
            </div>
            <button className="btn" onClick={() => navigate('/catalog')} type="button">
              Kembali ke katalog
            </button>
          </>
        ) : x.status === 'Failed' ? (
          <>
            <div className="note bad">
              <div>
                <b>
                  {x.reason === 'rejected'
                    ? 'Pembayaran tidak dapat dibuat.'
                    : x.reason === 'expired'
                    ? 'Kode QRIS kedaluwarsa.'
                    : 'Pembayaran gagal.'}
                </b>{' '}
                {x.reason === 'rejected'
                  ? 'Penyedia menolak permintaan transaksi. Tidak ada dana yang ditarik.'
                  : x.reason === 'expired'
                  ? 'Tidak ada pembayaran yang terkonfirmasi dalam 15 menit. Buat transaksi baru untuk mencoba lagi.'
                  : 'Penyedia melaporkan pembayaran gagal. Akses tidak diaktifkan.'}
              </div>
            </div>
            <button className="btn primary" onClick={() => onRetryBuy(x.packageId)} type="button">
              Coba bayar lagi
            </button>
          </>
        ) : (
          <>
            <div className="note info">
              <div>
                <b>Transaksi dibatalkan.</b> Tidak ada pembayaran yang diproses.
              </div>
            </div>
            <button className="btn" onClick={() => navigate('/catalog')} type="button">
              Kembali ke katalog
            </button>
          </>
        )}
      </div>

      {cf.length > 0 && (
        <div className="card stack">
          <h3>Konfirmasi dari penyedia</h3>
          {cf.map((c) => (
            <div key={c.id} className="small">
              <span className="mono">{c.id}</span> {c.provider} → <b>{c.state}</b> <span className="muted">{c.note}</span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

/* S-21 Konfirmasi Pembayaran */
function ConfirmationPage({ data }: { data: ReturnType<typeof initialSeed> }) {
  return (
    <>
      <div className="head">
        <div>
          <h1>Konfirmasi pembayaran</h1>
          <p className="muted">Setiap notifikasi penyedia diverifikasi terhadap idTransaksi, jumlah, pengguna, dan paket sebelum status disimpan (UC-21).</p>
        </div>
      </div>

      <div className="tw">
        <table>
          <thead>
            <tr>
              <th>Konfirmasi</th>
              <th>Transaksi</th>
              <th>Status penyedia</th>
              <th>Hasil verifikasi</th>
              <th>Status transaksi</th>
              <th>Keterangan</th>
            </tr>
          </thead>
          <tbody>
            {data.confirmations.map((c) => {
              const x = data.payments.find((y) => y.id === c.paymentId)
              const cls =
                {
                  Notified: 'c-ok',
                  PendingRecheck: 'c-mark',
                  VerificationFailed: 'c-bad',
                  OnHold: 'c-mark',
                  Ignored: 'c-idle',
                }[c.state] || 'c-info'
              return (
                <tr key={c.id}>
                  <td className="mono">
                    {c.id}
                    <div className="muted small">{c.at}</div>
                  </td>
                  <td className="mono">{c.paymentId}</td>
                  <td className="mono">{c.provider}</td>
                  <td>
                    <span className={`chip ${cls}`}>{c.state}</span>
                  </td>
                  <td>
                    {x && <span className={`chip ${PAY_CLS[x.status]}`}>{PAY_LABEL[x.status]}</span>}
                  </td>
                  <td className="small">{c.note}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

/* S-22 Log Aktivitas Sistem */
function LogPage({ data }: { data: ReturnType<typeof initialSeed> }) {
  const [filterUc, setFilterUc] = useState('')
  const ucs = useMemo(() => [...new Set(data.log.map((l) => l.uc))].sort(), [data.log])
  const list = useMemo(() => data.log.filter((l) => !filterUc || l.uc === filterUc), [data.log, filterUc])

  return (
    <>
      <div className="head">
        <div>
          <h1>Log aktivitas sistem</h1>
          <p className="muted">Use case beraktor Sistem dan layanan eksternal tercatat di sini sehingga dapat diamati saat demonstrasi.</p>
        </div>
        <label className="f">
          Saring use case
          <select value={filterUc} onChange={(e) => setFilterUc(e.target.value)}>
            <option value="">Semua</option>
            {ucs.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="tw">
        <table>
          <thead>
            <tr>
              <th>Waktu</th>
              <th>Use case</th>
              <th>Peristiwa</th>
            </tr>
          </thead>
          <tbody>
            {list.map((l, idx) => (
              <tr key={idx}>
                <td className="mono small">{l.t}</td>
                <td>
                  <span className="tag">{l.uc}</span>
                </td>
                <td>{l.msg}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

/* Master Data Page */
function MasterPage() {
  const [activeTab, setActiveTab] = useState<'education-levels' | 'subjects' | 'topics' | 'package-types'>('subjects')
  const [records, setRecords] = useState<Master[]>([])
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [subjects, setSubjects] = useState<Master[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    api<Master[]>(`/api/master/${activeTab}`)
      .then(setRecords)
      .catch((err: Error) => setError(err.message))
    if (activeTab === 'topics') {
      api<Master[]>('/api/master/subjects')
        .then(setSubjects)
        .catch(() => undefined)
    }
  }, [activeTab])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      const payload: Record<string, unknown> = { name }
      if (activeTab === 'package-types') payload.code = code
      if (activeTab === 'topics') payload.subjectId = subjectId
      const created = await api<Master>(`/api/master/${activeTab}`, json('POST', payload))
      setRecords((prev) => [...prev, created])
      setName('')
      setCode('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menambahkan data')
    }
  }

  async function handleDelete(itemId: string) {
    try {
      await api(`/api/master/${activeTab}/${itemId}`, json('DELETE'))
      setRecords((prev) => prev.filter((r) => r.id !== itemId))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus data')
    }
  }

  return (
    <>
      <div className="head">
        <div>
          <h1>Data master</h1>
          <p className="muted">Kelola jenjang pendidikan, mata pelajaran, topik, dan tipe paket.</p>
        </div>
      </div>

      <div className="tabs">
        {[
          ['education-levels', 'Jenjang Pendidikan'],
          ['subjects', 'Mata Pelajaran'],
          ['topics', 'Topik / Bab'],
          ['package-types', 'Tipe Paket'],
        ].map(([k, label]) => (
          <button
            key={k}
            className={`tab ${activeTab === k ? 'on' : ''}`}
            onClick={() => setActiveTab(k as 'education-levels' | 'subjects' | 'topics' | 'package-types')}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="note bad">
          <div>{error}</div>
        </div>
      )}

      <form className="card row" onSubmit={handleAdd}>
        <input
          type="text"
          placeholder="Nama data..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          style={{ maxWidth: 280 }}
        />
        {activeTab === 'package-types' && (
          <input
            type="text"
            placeholder="Kode (contoh: SNBT)"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            style={{ maxWidth: 180 }}
          />
        )}
        {activeTab === 'topics' && (
          <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} required style={{ maxWidth: 200 }}>
            <option value="">Pilih Mapel</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
        <button className="btn primary" type="submit">
          Tambah
        </button>
      </form>

      <div className="tw">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Nama</th>
              {activeTab === 'package-types' && <th>Kode</th>}
              {activeTab === 'topics' && <th>Mata Pelajaran</th>}
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id}>
                <td className="mono">{r.id.slice(-8)}</td>
                <td>{r.name}</td>
                {activeTab === 'package-types' && <td className="mono">{r.code}</td>}
                {activeTab === 'topics' && <td>{r.subject?.name || '-'}</td>}
                <td>
                  <button className="btn sm danger" onClick={() => handleDelete(r.id)} type="button">
                    Hapus
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
