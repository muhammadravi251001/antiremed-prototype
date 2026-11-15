import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { BrowserRouter, Link, NavLink, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'
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
  CAT,
  USERS,
  wait,
  checkIssues,
} from './data'
import './App.css'

const ROLE_NAV: Record<Role, [string, [string, string, string?][]][]> = {
  teacher: [
    ['', [['/', 'Beranda']]],
    ['Konten', [['/generator', 'Buat soal'], ['/questions', 'Bank soal', 'review'], ['/media', 'Pustaka gambar']]],
    ['Distribusi', [['/packages', 'Paket soal'], ['/results', 'Laporan belajar']]],
    ['Administrasi', [['/payments', 'Transaksi'], ['/logs', 'Log aktivitas'], ['/master', 'Data master']]],
  ],
  student: [
    ['', [['/quiz', 'Kuis saya']]],
  ],
  payer: [
    ['', [['/catalog', 'Paket belajar'], ['/messages', 'Laporan belajar']]],
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
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [toasts, setToasts] = useState<{ id: number; msg: string; bad?: boolean }[]>([])
  const [modal, setModal] = useState<React.ReactNode | null>(null)

  // Current selections
  const [, setSelectedQid] = useState<string>('Q-1004')
  const [selectedPid, setSelectedPid] = useState<string>('P-301')
  const [selectedPayId, setSelectedPayId] = useState<string>('PAY-0901')
  const [activeQuizAttempt, setActiveQuizAttempt] = useState<ActiveAttemptState | null>(null)
  const [activePipeline, setActivePipeline] = useState<PipelineState | null>(null)

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
    showToast(`${activePay.id}: ${state}`)
  }

  const currentUser = useMemo(() => {
    if (!role) return null
    if (role === 'teacher') return { ...USERS['rina.wulandari@antiremed.id'], email: 'rina.wulandari@antiremed.id' }
    if (role === 'student') return { ...USERS['dimas.pratama@siswa.antiremed.id'], email: 'dimas.pratama@siswa.antiremed.id' }
    return { ...USERS['sari.pratama@email.co.id'], email: 'sari.pratama@email.co.id' }
  }, [role])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'K' || e.key === 'k')) {
        e.preventDefault()
        setDrawerOpen((prev) => !prev)
      }
      if (e.key === 'Escape') {
        setUserMenuOpen(false)
        setMobileNavOpen(false)
      }
    }
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.mwrap')) {
        setUserMenuOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('click', handleClickOutside)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('click', handleClickOutside)
    }
  }, [])

  return (
    <div>
      <a className="skip" href="#main">
        Lewati ke konten utama
      </a>
      <header className="top">
        {role && (
          <button
            className="iconbtn menu-btn"
            id="menuBtn"
            type="button"
            aria-label="Buka menu navigasi"
            aria-controls="side"
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen(true)}
          >
            <svg className="ic" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}
        <Link className="brand" to={role ? '/' : '/landing'} onClick={() => setMobileNavOpen(false)}>
          <span className="mk" aria-hidden="true">A</span>
          <span>
            Antiremed Studio
            <small>Bimbel Antiremed</small>
          </span>
        </Link>
        <div className="sp" />
        {currentUser ? (
          <div className="rolepill">
            <span className="env" title="Lingkungan staging: data dan transaksi tidak diproses oleh layanan produksi">
              Staging
            </span>
            <div className="mwrap">
              <button
                className="userbtn"
                type="button"
                aria-haspopup="menu"
                aria-expanded={userMenuOpen}
                aria-controls="umenu"
                aria-label={`Menu akun ${currentUser.name}`}
                onClick={() => setUserMenuOpen((prev) => !prev)}
              >
                <span className="avatar" aria-hidden="true">
                  {currentUser.name.split(' ').map((x) => x[0]).join('').slice(0, 2)}
                </span>
                <span className="who">
                  <b>{currentUser.name}</b>
                  <span>{currentUser.title}</span>
                </span>
                <svg className="ic" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              <div className="menu" id="umenu" role="menu" hidden={!userMenuOpen}>
                <div className="mhead">
                  <b>{currentUser.name}</b>
                  <div className="xs muted">{currentUser.title}</div>
                  <div className="xs muted">{currentUser.email}</div>
                </div>
                <button
                  className="mi danger"
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    setUserMenuOpen(false)
                    handleLogout()
                  }}
                >
                  <svg className="ic" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4" />
                    <path d="M10 17l-5-5 5-5" />
                    <path d="M5 12h11" />
                  </svg>
                  Keluar
                </button>
              </div>
            </div>
          </div>
        ) : (
          <nav className="lp-nav" aria-label="Halaman utama">
            <a href="#fitur">Fitur</a>
            <a href="#cara-kerja">Cara kerja</a>
            <a href="#paket">Paket belajar</a>
            <a href="#faq">Tanya jawab</a>
            <button className="btn primary sm" onClick={() => navigate('/login')} type="button">
              Masuk
            </button>
          </nav>
        )}
      </header>

      <div className={`shell ${!role ? 'public single-col' : ''}`}>
        {role && (
          <>
            <nav className={`side ${mobileNavOpen ? 'open' : ''}`} id="side" aria-label="Navigasi utama">
              <div className="row between" style={{ padding: '0 var(--s1) var(--s2)' }}>
                <span className="xs muted" style={{ fontWeight: 700 }}>Menu</span>
                <button
                  className="iconbtn navclose"
                  type="button"
                  aria-label="Tutup menu"
                  onClick={() => setMobileNavOpen(false)}
                >
                  <svg className="ic" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </button>
              </div>
              {ROLE_NAV[role].map(([grp, items]) => (
                <React.Fragment key={grp}>
                  {grp ? <div className="grp">{grp}</div> : null}
                  {items.map(([to, label, badge]) => (
                    <NavLink
                      key={to}
                      to={to}
                      end={to === '/'}
                      className={({ isActive }) => `nav ${isActive ? 'on' : ''}`}
                      onClick={() => setMobileNavOpen(false)}
                    >
                      <span>{label}</span>
                      {badge === 'review' && waitingReviewCount > 0 && <span className="cnt">{waitingReviewCount}</span>}
                    </NavLink>
                  ))}
                </React.Fragment>
              ))}
              <div className="foot">Bimbel Antiremed · lingkungan staging</div>
            </nav>
            <div
              className="navscrim"
              hidden={!mobileNavOpen}
              onClick={() => setMobileNavOpen(false)}
            />
          </>
        )}

        <main id="main" tabIndex={-1}>
          <div className="wrap">
            <Routes>
              {/* Landing Page */}
              <Route path="/landing" element={<LandingPage packages={data.packages} onLoginClick={() => navigate('/login')} />} />

              {/* S-00 Login */}
              <Route path="/login" element={<LoginPage onSelectRole={(r) => { setRole(r); navigate(r === 'teacher' ? '/' : r === 'student' ? '/quiz' : '/catalog') }} onBackToHome={() => navigate('/landing')} />} />

              {/* S-01 Dashboard */}
              <Route
                path="/"
                element={
                  !role ? (
                    <LandingPage packages={data.packages} onLoginClick={() => navigate('/login')} />
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
              <Route
                path="/master"
                element={<MasterPage data={data} setData={setData} addLog={addLog} showToast={showToast} setModal={setModal} />}
              />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>
      </div>

      {/* Drawer Konsol Integrasi */}
      <aside className="drawer" id="drawer" hidden={!drawerOpen} aria-label="Konsol integrasi">
        <h2>
          Konsol integrasi{' '}
          <button className="btn sm" onClick={() => setDrawerOpen(false)} type="button">
            Tutup
          </button>
        </h2>
        <p className="small muted">Khusus lingkungan staging. Atur respons layanan pihak ketiga untuk pengujian.</p>

        <div className="sim">
          <label htmlFor="sim-ai">Layanan AI teks</label>
          <select id="sim-ai" value={sim.ai} onChange={(e) => setSim({ ...sim, ai: e.target.value as SimulationSettings['ai'] })}>
            <option value="success">Normal</option>
            <option value="fail">Tidak merespons</option>
          </select>

          <label htmlFor="sim-explain">Pembahasan AI</label>
          <select id="sim-explain" value={sim.explain} onChange={(e) => setSim({ ...sim, explain: e.target.value as SimulationSettings['explain'] })}>
            <option value="complete">Lengkap</option>
            <option value="incomplete">Tidak lengkap</option>
          </select>

          <label htmlFor="sim-detect">Deteksi gambar</label>
          <select id="sim-detect" value={sim.detect} onChange={(e) => setSim({ ...sim, detect: e.target.value as SimulationSettings['detect'] })}>
            <option value="auto">Sesuai isi soal</option>
            <option value="Required">Selalu perlu</option>
            <option value="NeedsCheck">Tidak yakin</option>
            <option value="NotRequired">Tidak perlu</option>
          </select>

          <label htmlFor="sim-repo">Pustaka gambar</label>
          <select id="sim-repo" value={sim.repo} onChange={(e) => setSim({ ...sim, repo: e.target.value as SimulationSettings['repo'] })}>
            <option value="found">Ada hasil</option>
            <option value="none">Kosong</option>
          </select>

          <label htmlFor="sim-ext">Sumber berlisensi</label>
          <select id="sim-ext" value={sim.ext} onChange={(e) => setSim({ ...sim, ext: e.target.value as SimulationSettings['ext'] })}>
            <option value="found">Ada hasil</option>
            <option value="none">Kosong</option>
            <option value="down">Tidak tersedia</option>
          </select>

          <label htmlFor="sim-img">Layanan AI gambar</label>
          <select id="sim-img" value={sim.img} onChange={(e) => setSim({ ...sim, img: e.target.value as SimulationSettings['img'] })}>
            <option value="success">Normal</option>
            <option value="fail">Gagal</option>
          </select>

          <label htmlFor="sim-upload">Penyimpanan</label>
          <select id="sim-upload" value={sim.upload} onChange={(e) => setSim({ ...sim, upload: e.target.value as SimulationSettings['upload'] })}>
            <option value="success">Normal</option>
            <option value="fail">Gagal</option>
          </select>

          <label htmlFor="sim-submit">Koneksi kuis</label>
          <select id="sim-submit" value={sim.submit} onChange={(e) => setSim({ ...sim, submit: e.target.value as SimulationSettings['submit'] })}>
            <option value="success">Normal</option>
            <option value="fail">Terputus</option>
          </select>

          <label htmlFor="sim-match">Pencocokan nilai</label>
          <select id="sim-match" value={sim.match} onChange={(e) => setSim({ ...sim, match: e.target.value as SimulationSettings['match'] })}>
            <option value="match">Cocok</option>
            <option value="mismatch">Tidak cocok</option>
          </select>

          <label htmlFor="sim-stuContact">Kontak siswa</label>
          <select id="sim-stuContact" value={sim.stuContact} onChange={(e) => setSim({ ...sim, stuContact: e.target.value as SimulationSettings['stuContact'] })}>
            <option value="auto">Sesuai data</option>
            <option value="missing">Kosong</option>
          </select>

          <label htmlFor="sim-parentLink">Verifikasi wali</label>
          <select id="sim-parentLink" value={sim.parentLink} onChange={(e) => setSim({ ...sim, parentLink: e.target.value as SimulationSettings['parentLink'] })}>
            <option value="auto">Terverifikasi</option>
            <option value="unverified">Belum</option>
          </select>

          <label htmlFor="sim-channel">Layanan pesan</label>
          <select id="sim-channel" value={sim.channel} onChange={(e) => setSim({ ...sim, channel: e.target.value as SimulationSettings['channel'] })}>
            <option value="sent">Normal</option>
            <option value="fail">Gagal</option>
          </select>

          <label htmlFor="sim-qris">Penerbitan QRIS</label>
          <select id="sim-qris" value={sim.qris} onChange={(e) => setSim({ ...sim, qris: e.target.value as SimulationSettings['qris'] })}>
            <option value="ok">Normal</option>
            <option value="rejected">Ditolak</option>
          </select>
        </div>

        <hr />
        <h3>Notifikasi penyedia pembayaran</h3>
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
          Kirim notifikasi
        </button>
        <span className="small muted">Dikirim untuk transaksi yang sedang dibuka atau transaksi aktif terakhir.</span>

        <hr />
        <button className="btn danger" onClick={handleResetDemo} type="button">
          Pulihkan data staging
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

/* ===================== Landing Page ===================== */
function LandingPage({ packages, onLoginClick }: { packages: PackageItem[]; onLoginClick: () => void }) {
  const readyPackages = packages.filter((p) => p.status === 'Ready')

  return (
    <div className="lp">
      <section className="hero">
        <div className="stack" style={{ gap: 16 }}>
          <span className="eyebrow">Bimbel Antiremed</span>
          <h1>Satu tempat untuk menyusun, memeriksa, dan membagikan soal latihan</h1>
          <p className="lead">
            Antiremed Studio membantu pengajar membuat soal berbantuan AI lengkap dengan pembahasan setiap pilihan jawaban,
            menyiapkan gambar soal tanpa menyalin tautan satu per satu, lalu membagikan paket latihan kepada siswa.
            Setiap soal tetap diperiksa pengajar sebelum digunakan.
          </p>
          <div className="row">
            <button className="btn primary" onClick={onLoginClick} type="button">
              Masuk ke akun
            </button>
            <a className="btn" href="#paket">
              Lihat paket belajar
            </a>
          </div>
        </div>

        <div className="hero-card" aria-hidden="true">
          <div className="row between">
            <b className="small">Q-1003 · Teorema Pythagoras</b>
            <span className="chip c-ok">Tervalidasi</span>
          </div>
          <p className="small">Perhatikan gambar segitiga ABC. Jika AB = 5 cm dan BC = 12 cm, panjang AC adalah ...</p>
          <img
            src={IMG.tri}
            alt=""
            style={{ width: '100%', maxHeight: 150, objectFit: 'contain', background: '#fff', borderRadius: 6, border: '1px solid var(--line)' }}
          />
          <div className="opt ok">
            <span className="l">A</span>
            <div>
              <div>13 cm</div>
              <div className="expl">Benar. AC = √(5² + 12²) = √169 = 13 cm.</div>
            </div>
          </div>
          <div className="opt">
            <span className="l">B</span>
            <div>
              <div>17 cm</div>
              <div className="expl">Salah. 17 cm adalah AB + BC, bukan sisi miring.</div>
            </div>
          </div>
        </div>
      </section>

      <section className="stack" id="fitur" style={{ gap: 16 }}>
        <h2 className="sec">Dirancang untuk alur kerja pengajar</h2>
        <div className="grid g4">
          <div className="card feat">
            <div className="ic">1</div>
            <h3>Soal dan pembahasan lengkap</h3>
            <p className="small muted">
              AI menyusun pertanyaan, kunci jawaban, dan alasan mengapa setiap pilihan benar atau salah, sehingga siswa dapat belajar dari kesalahannya.
            </p>
          </div>
          <div className="card feat">
            <div className="ic">2</div>
            <h3>Gambar langsung tertaut</h3>
            <p className="small muted">
              Gambar diambil dari pustaka Antiremed, sumber berlisensi, atau dibuat AI, lalu tersimpan dan terhubung ke soal secara otomatis.
            </p>
          </div>
          <div className="card feat">
            <div className="ic">3</div>
            <h3>Diperiksa sebelum dipakai</h3>
            <p className="small muted">
              Hanya soal yang sudah diterima pengajar yang dapat masuk paket. Setiap keputusan dan revisi tercatat.
            </p>
          </div>
          <div className="card feat">
            <div className="ic">4</div>
            <h3>Hasil sampai ke orang tua</h3>
            <p className="small muted">
              Siswa mengerjakan kuis, nilai tersimpan otomatis, dan ringkasan hasil dikirim kepada wali melalui WhatsApp atau email.
            </p>
          </div>
        </div>
      </section>

      <section className="stack" id="cara-kerja" style={{ gap: 16 }}>
        <h2 className="sec">Cara kerja</h2>
        <ol className="steps">
          <li>
            <b>Tentukan kebutuhan soal</b>
            <span className="small muted">Pilih jenjang, mata pelajaran, topik, jumlah, dan tingkat kesulitan.</span>
          </li>
          <li>
            <b>Periksa hasil AI</b>
            <span className="small muted">Terima, ubah, atau tolak soal. Tambahkan gambar bila diperlukan.</span>
          </li>
          <li>
            <b>Susun paket</b>
            <span className="small muted">Gabungkan soal tervalidasi menjadi latihan, ulangan harian, TKA, atau SNBT.</span>
          </li>
          <li>
            <b>Bagikan dan pantau</b>
            <span className="small muted">Siswa mengerjakan kuis, pengajar dan orang tua menerima laporannya.</span>
          </li>
        </ol>
      </section>

      <section className="stack" id="paket" style={{ gap: 16 }}>
        <div className="row between">
          <h2 className="sec">Paket belajar tersedia</h2>
          <span className="small muted">Pembayaran melalui QRIS</span>
        </div>
        {readyPackages.length ? (
          <div className="grid g3">
            {readyPackages.map((p) => (
              <div key={p.id} className="card stack">
                <span className="small muted">
                  {p.type} · {p.qids.length} soal
                </span>
                <b>{p.title}</b>
                <span className="price">{p.price ? rp(p.price) : 'Gratis'}</span>
                <button className={`btn ${p.price ? 'primary' : ''}`} onClick={onLoginClick} type="button">
                  {p.price ? 'Masuk untuk membeli' : 'Masuk untuk mengerjakan'}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="card empty">Paket baru sedang disiapkan pengajar.</div>
        )}
      </section>

      <footer className="lp-foot">
        <span>© {new Date().getFullYear()} Bimbel Antiremed</span>
        <span>Data siswa digunakan hanya untuk keperluan belajar dan dibagikan kepada wali yang terdaftar.</span>
      </footer>
    </div>
  )
}

/* S-00 Login */
function LoginPage({
  onSelectRole,
  onBackToHome,
}: {
  onSelectRole: (role: Role) => void
  onBackToHome?: () => void
}) {
  const [email, setEmail] = useState('rina.wulandari@antiremed.id')
  const [password, setPassword] = useState('demo1234')
  const [errors, setErrors] = useState<{ email?: string; pass?: string; form?: string }>({})

  const accts = Object.entries(USERS)

  function handleSelectAccount(em: string) {
    const u = USERS[em]
    if (u) {
      setEmail(em)
      setPassword('demo1234')
      setErrors({})
      onSelectRole(u.role)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmedEmail = email.trim().toLowerCase()
    const err: { email?: string; pass?: string; form?: string } = {}
    if (!trimmedEmail) err.email = 'Masukkan email Anda'
    else if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) err.email = 'Format email belum benar, contoh: nama@antiremed.id'
    if (!password) err.pass = 'Masukkan kata sandi'
    else if (password.length < 6) err.pass = 'Kata sandi minimal 6 karakter'

    const user = USERS[trimmedEmail]
    if (!Object.keys(err).length && !user) {
      err.form = 'Email atau kata sandi tidak sesuai. Periksa kembali atau hubungi admin Bimbel Antiremed.'
    }

    if (Object.keys(err).length) {
      setErrors(err)
      return
    }

    if (user) {
      onSelectRole(user.role)
    }
  }

  return (
    <div className="login" style={{ maxWidth: 440 }}>
      <div className="stack">
        <h1>Masuk ke Antiremed Studio</h1>
        <p className="muted">Gunakan email yang terdaftar di Bimbel Antiremed.</p>
      </div>

      <form className="card stack" onSubmit={handleSubmit} noValidate>
        {errors.form && (
          <div className="note bad">
            <div>{errors.form}</div>
          </div>
        )}
        <label className="f">
          Email
          <input
            type="email"
            autoComplete="username"
            placeholder="nama@antiremed.id"
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
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={errors.pass ? 'invalid' : ''}
          />
          {errors.pass && <span className="err">{errors.pass}</span>}
        </label>
        <button className="btn primary" type="submit" style={{ justifyContent: 'center' }}>
          Masuk
        </button>
        <span className="small muted">Lupa kata sandi? Hubungi admin Bimbel Antiremed untuk mengatur ulang.</span>
      </form>

      <div className="stack">
        <span className="small muted">Akun yang pernah masuk di perangkat ini</span>
        {accts.map(([em, u]) => (
          <button key={em} className="acct" onClick={() => handleSelectAccount(em)} type="button">
            <div className="avatar">
              {u.name.split(' ').map((x) => x[0]).join('').slice(0, 2)}
            </div>
            <span>
              <b>{u.name}</b>
              <small>
                {u.title} · {em}
              </small>
            </span>
          </button>
        ))}
      </div>

      {onBackToHome && (
        <button className="btn ghost sm" onClick={onBackToHome} type="button" style={{ alignSelf: 'flex-start' }}>
          ← Kembali ke halaman utama
        </button>
      )}
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
          <h2>Aktivitas terbaru</h2>
          {data.log.slice(0, 6).map((l, idx) => (
            <div key={idx} className="small">
              <span className="tag">{CAT[l.uc] || 'Sistem'}</span> {l.msg}
              <div className="muted mono">{l.t}</div>
            </div>
          ))}
          <Link className="btn sm ghost" to="/logs">
            Lihat semua aktivitas
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
            <span className="muted small">Proses biasanya selesai dalam satu menit.</span>
            <button className="btn primary" type="submit">
              Hasilkan soal
            </button>
          </div>
        </form>

        <div className="card flat stack small">
          <h3>Yang Anda terima</h3>
          <p>1. Pertanyaan, lima pilihan jawaban, dan kunci.</p>
          <p>2. Pembahasan untuk setiap pilihan, termasuk alasan pilihan yang salah.</p>
          <p>3. Klasifikasi jenjang, mata pelajaran, dan topik agar mudah dicari di bank soal.</p>
          <p>4. Penanda soal yang memerlukan gambar.</p>
          <p className="muted">Anda dapat meninggalkan halaman ini selama proses berjalan.</p>
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
    ['', 'Menyusun pertanyaan, pilihan, dan kunci'],
    ['', 'Menulis pembahasan setiap pilihan'],
    ['', 'Menyimpan soal dan klasifikasi'],
    ['', 'Memeriksa kebutuhan gambar'],
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
          notes: ['Tidak ada respons dalam 120 detik'],
          state: 'fail',
        } : null))
        addLog('UC-01', 'Layanan AI tidak merespons; tidak ada soal yang disimpan')
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
      addLog('UC-01', `${ids.length} soal baru dibuat (${ids.join(', ')})`)

      await wait(800)
      let warn = ''
      if (sim.explain === 'incomplete') {
        newQuestions[0].options[3].explanation = ''
        newQuestions[0].flags = ['Penjelasan opsi D kosong']
        warn = 'Satu soal ditandai Perlu Revisi karena pembahasan opsi D belum tersedia.'
        setPState((prev) => (prev ? {
          ...prev,
          steps: ['done', 'warn', 'run', 'wait'],
          notes: [prev.notes[0], '1 soal pembahasannya belum lengkap'],
        } : null))
        addLog('UC-02', `Pembahasan ${ids[0]} belum lengkap, ditandai untuk diperbaiki`)
      } else {
        setPState((prev) => (prev ? {
          ...prev,
          steps: ['done', 'done', 'run', 'wait'],
          notes: [prev.notes[0], 'Semua pilihan memiliki pembahasan'],
        } : null))
        addLog('UC-02', `Pembahasan dibuat untuk ${ids.length} soal`)
      }

      await wait(700)
      setPState((prev) => (prev ? {
        ...prev,
        steps: ['done', prev.steps[1], 'done', 'run'],
        notes: [prev.notes[0], prev.notes[1], `${SUBJECTS[p.subject] || p.subject} · ${p.level} · ${p.topic}`],
      } : null))
      addLog('UC-03', `${ids.length} soal tersimpan di bank soal`)

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
        notes: [prev.notes[0], prev.notes[1], prev.notes[2], `${cnt.Required} perlu gambar, ${cnt.NeedsCheck} perlu dipastikan`],
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
          <h1>Proses pembuatan soal</h1>
          <p className="muted">
            {SUBJECTS[p.subject] || p.subject} · {p.level} · {p.topic} · {p.count} soal
          </p>
        </div>
      </div>

      <div className="split">
        <div className="card">
          <div className="pipe">
            {names.map(([, n], i) => {
              const s = steps[i] || 'wait'
              return (
                <div key={i} className={`step ${s}`}>
                  <div className="dot">{s === 'done' ? '✓' : s === 'fail' || s === 'warn' ? '!' : ''}</div>
                  <div>
                    <b>{n}</b>
                    <div className="small muted">
                      {notes[i] ? notes[i] : '\u00a0'}
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
                  <b>Layanan AI sedang tidak merespons.</b> Belum ada soal yang tersimpan dan pengaturan Anda tidak hilang. Coba lagi dalam beberapa saat atau ubah pengaturan soal.
                </div>
              </div>
              <div className="row">
                <Link className="btn primary" to="/generator">
                  Coba lagi
                </Link>
                <Link className="btn" to="/generator">
                  Ubah pengaturan
                </Link>
              </div>
            </>
          ) : state === 'done' ? (
            <>
              <div className={`note ${warn ? 'warn' : 'ok'}`}>
                <div>
                  <b>{ids.length} soal tersimpan sebagai draf.</b> {warn || 'Soal siap ditinjau.'}
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
              <div>Soal sedang disusun. Anda dapat membuka halaman lain; proses tetap berjalan dan hasilnya muncul di Bank soal.</div>
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
          <p className="muted">Cari soal berdasarkan mata pelajaran, jenjang, topik, dan status pemeriksaan.</p>
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
    addLog('UC-04', `${q.id} ditunda: ditandai perlu revisi`)
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
                ✓ Pertanyaan, pilihan, kunci, pembahasan, dan gambar lengkap
              </div>
            )}
            <div className="small muted">
              {q.options.length} pilihan jawaban · {SUBJECTS[q.subject] || q.subject} · {q.level}
            </div>
          </div>

          {canDecide ? (
            <div className="card stack">
              <h3>Keputusan</h3>
              <button className="btn primary" onClick={handleAccept} disabled={iss.length > 0} type="button">
                Terima soal
              </button>
              {iss.length > 0 && <span className="small muted">Lengkapi kekurangan di atas untuk dapat menerima soal.</span>}
              <button className="btn" onClick={() => onEditQ(q.id)} type="button">
                Ubah soal
              </button>
              {q.mediaReq !== 'NotRequired' && (
                <button className="btn" onClick={() => onMediaQ(q.id)} type="button">
                  Atur gambar
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
            <b>Perubahan belum dapat disimpan.</b> Lengkapi isian yang ditandai merah.
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
        setErr('Sumber gambar sedang tidak dapat dihubungi. Coba lagi beberapa saat lagi atau gunakan pustaka Antiremed.')
      } else if (sim.ext === 'none') {
        setEmpty(true)
      } else {
        const k = topicKey(q)
        setCands([
          { title: 'Diagram ' + q.topic.toLowerCase() + ' (CC BY 4.0)', img: k === 'tri' ? IMG.tri2 : IMG[k], source: 'Repositori pendidikan terbuka', rights: 'CC BY 4.0', ok: true },
          { title: 'Ilustrasi ' + q.topic.toLowerCase() + ' dari galeri umum', img: k === 'tri' ? IMG.tri3 : IMG[k], source: 'Galeri gambar umum', rights: '', ok: false },
        ])
      }
    } else {
      addLog('UC-11', `Generate media untuk ${q.id}`)
      if (sim.img === 'fail') {
        setErr('Gambar belum berhasil dibuat. Coba lagi, ubah deskripsi gambar, atau cari di pustaka.')
      } else {
        setCands([
          { title: 'Gambar hasil AI: ' + q.topic.toLowerCase(), img: topicKey(q) === 'tri' ? IMG.tri3 : IMG[topicKey(q)], source: 'Dibuat dengan AI', rights: 'Milik Antiremed', ok: true, ai: true },
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
      setUploadSteps([...steps, 'Gambar dari pustaka dipakai ulang tanpa diunggah lagi', '✓ Gambar terpasang pada soal'])
      addLog('UC-12', `Gambar ${c.existing} dipasang pada ${q.id}`)
      showToast('Gambar terpasang pada soal')
      return
    }

    // Upload simulation
    let success = false
    for (let a = 1; a <= 3; a++) {
      steps.push(`Menyimpan ke pustaka gambar${a > 1 ? ' (percobaan ' + a + ')' : ''}…`)
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
        steps.push(`✓ Tersimpan sebagai ${mId} dan terpasang pada soal`)
        setUploadSteps([...steps])
        addLog('UC-12', `Gambar ${mId} disimpan dan dipasang pada ${q.id}`)
        showToast('Gambar tersimpan dan terpasang')
        success = true
        break
      }
      steps.push(`✕ Gagal menyimpan`)
      setUploadSteps([...steps])
    }

    if (!success) {
      steps.push('Gambar belum tersimpan setelah tiga kali percobaan. Soal tetap menunggu gambar.')
      setUploadSteps([...steps])
      setUploadFail(true)
      addLog('UC-12', `Penyimpanan gambar untuk ${q.id} gagal setelah 3 percobaan`)
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
                <b>Sistem belum yakin soal ini memerlukan gambar.</b> Pastikan berdasarkan isi soal.
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
                  addLog('UC-08', `Kebutuhan gambar ${q.id} dipastikan: ${MR_LABEL.Required}`)
                }}
                type="button"
              >
                Ya, perlu gambar
              </button>
              <button
                className="btn"
                onClick={() => {
                  setData((prev) => ({
                    ...prev,
                    questions: prev.questions.map((item) => (item.id === q.id ? { ...item, mediaReq: 'NotRequired' } : item)),
                  }))
                  addLog('UC-08', `Kebutuhan gambar ${q.id} dipastikan: ${MR_LABEL.NotRequired}`)
                }}
                type="button"
              >
                Tidak perlu gambar
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
                ['repo', 'Pustaka Antiremed'],
                ['ext', 'Sumber berlisensi'],
                ['ai', 'Buat dengan AI'],
              ].map(([k, l]) => (
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
                  {l}
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
                <b>Belum ada gambar yang cocok.</b>
                <span>
                  {tab === 'repo'
                    ? 'Coba cari di sumber berlisensi.'
                    : 'Anda dapat membuat gambar baru dengan AI.'}
                </span>
                <button className="btn" onClick={() => setTab(tab === 'repo' ? 'ext' : 'ai')} type="button">
                  {tab === 'repo' ? 'Cari di sumber berlisensi' : 'Buat dengan AI'}
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
                    {c.ai && <span className="small muted">Gambar buatan AI. Periksa ketepatan label dan angka sebelum dipakai.</span>}
                    <button className={`btn sm ${c.ok ? 'primary' : ''}`} onClick={() => handleUse(c)} disabled={!c.ok} type="button">
                      {c.ok ? 'Gunakan gambar ini' : 'Lisensi perlu dikonfirmasi'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {uploadSteps.length > 0 && (
              <div className="card stack">
                <h3>Menyimpan gambar</h3>
                {uploadSteps.map((u, idx) => (
                  <div key={idx} className="small">
                    {u}
                  </div>
                ))}
                {uploadFail && pendingCand && (
                  <div className="row">
                    <button className="btn primary" onClick={() => handleUse(pendingCand)} type="button">
                      Simpan ulang
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
    if (!p.qids.length) v.push('Pilih sekurang-kurangnya satu soal')

    p.qids.forEach((qid) => {
      const q = data.questions.find((x) => x.id === qid)
      if (q) {
        if (q.status !== 'Accepted') v.push(`${qid} belum tervalidasi`)
        if (q.mediaReq === 'Required' || q.mediaReq === 'NeedsCheck') v.push(`${qid} masih menunggu gambar`)
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
      addLog('UC-13', `Paket ${p.title} belum siap: ${v.length} kekurangan`)
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
                      {!ok && <span className="small muted">Tinjau dan terima soal ini terlebih dahulu</span>}
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
      <div className="head">
        <div>
          <h1>Kuis saya</h1>
          <p className="muted">Kerjakan paket dari pengajar. Nilai dan pembahasan tersimpan otomatis.</p>
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
                    <span className="small muted">Minta orang tua mengaktifkan paket ini melalui akun mereka.</span>
                  )}
                </div>
              )
            })
          ) : (
            <div className="empty">
              <b>Belum ada kuis.</b>
              <span>Paket baru akan muncul di sini setelah pengajar membagikannya.</span>
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
      addLog('UC-14', 'Pengiriman jawaban kuis gagal karena koneksi terputus')
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
              <b>Jawaban belum terkirim.</b> Koneksi terputus. Jawaban Anda masih tersimpan di perangkat ini, silakan kirim ulang.
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
                <b>Jawaban terkirim dan nilai tersimpan.</b>
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
              <b>Jawaban diterima, tetapi nilai belum tercatat di akun Anda.</b> Pengajar akan memeriksa dan menambahkannya. Anda tidak perlu mengerjakan ulang.
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
          <h1>Laporan belajar</h1>
          <p className="muted">Ringkasan nilai disusun otomatis setelah siswa mengirim jawaban, lalu dikirim kepada siswa dan walinya.</p>
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
          <b>Belum ada laporan.</b>
          <span>Laporan akan muncul setelah siswa menyelesaikan kuis.</span>
        </div>
      )}

      {data.attempts.some((a) => a.status !== 'Stored') && (
        <div className="card stack">
          <h3>Jawaban yang perlu diperiksa</h3>
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
          Saya orang tua/wali Dimas dan menyetujui data belajarnya diproses untuk keperluan belajar di Bimbel Antiremed.
        </label>
        {error && <span className="err">{error}</span>}

        <div className="row between">
          <span className="small muted">Akses aktif setelah pembayaran terkonfirmasi.</span>
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
                <div>Halaman ini diperbarui otomatis setelah pembayaran dikonfirmasi. Jangan tutup halaman sebelum status berubah.</div>
              </div>
              <div className="row">
                <button
                  className="btn"
                  onClick={() => {
                    addLog('UC-21', `Status ${x.id} diperiksa ulang: ${PAY_LABEL[x.status]}`)
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
              <span className="small muted">Lingkungan staging: kode ini tidak terhubung ke bank dan tidak menarik dana.</span>
            </div>
          </div>
        ) : x.status === 'Pending' ? (
          <>
            <div className="note warn">
              <div>
                <b>Pembayaran sedang diproses.</b> Akses paket akan aktif setelah pembayaran terkonfirmasi. Status diperiksa ulang secara berkala.
              </div>
            </div>
            <div className="row">
              <button
                className="btn"
                onClick={() => {
                  addLog('UC-21', `Status ${x.id} diperiksa ulang: ${PAY_LABEL[x.status]}`)
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
                <b>Pembayaran berhasil.</b> Dimas sudah dapat mengerjakan {p ? p.title : ''}.
              </div>
            </div>
            <button className="btn" onClick={() => navigate('/catalog')} type="button">
              Kembali ke paket belajar
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
                  ? 'Transaksi tidak dapat dibuat saat ini. Tidak ada dana yang ditarik. Silakan coba lagi.'
                  : x.reason === 'expired'
                  ? 'Tidak ada pembayaran yang terkonfirmasi dalam 15 menit. Buat transaksi baru untuk mencoba lagi.'
                  : 'Pembayaran tidak berhasil dan akses belum diaktifkan. Silakan coba lagi atau gunakan aplikasi pembayaran lain.'}
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
              Kembali ke paket belajar
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
          <h1>Transaksi</h1>
          <p className="muted">Setiap notifikasi pembayaran dicocokkan dengan ID transaksi, jumlah, pembeli, dan paket sebelum akses diaktifkan.</p>
        </div>
      </div>

      <div className="tw">
        <table>
          <thead>
            <tr>
              <th>Waktu</th>
              <th>Transaksi</th>
              <th>Status penyedia</th>
              <th>Hasil pencocokan</th>
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
                  <td className="mono small">{c.at}</td>
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
  const [filterCategory, setFilterCategory] = useState('')
  const categories = useMemo(() => [...new Set(data.log.map((l) => CAT[l.uc] || 'Sistem'))].sort(), [data.log])
  const list = useMemo(
    () => data.log.filter((l) => !filterCategory || (CAT[l.uc] || 'Sistem') === filterCategory),
    [data.log, filterCategory]
  )

  return (
    <>
      <div className="head">
        <div>
          <h1>Log aktivitas</h1>
          <p className="muted">Catatan aktivitas pengguna, proses otomatis, dan layanan yang terhubung.</p>
        </div>
        <label className="f">
          Kategori
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
            <option value="">Semua</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="tw">
        <table>
          <thead>
            <tr>
              <th>Waktu</th>
              <th>Kategori</th>
              <th>Aktivitas</th>
            </tr>
          </thead>
          <tbody>
            {list.map((l, idx) => (
              <tr key={idx}>
                <td className="mono small">{l.t}</td>
                <td>
                  <span className="tag">{CAT[l.uc] || 'Sistem'}</span>
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
const MD_TABS: [string, string, string][] = [
  ['level', 'Jenjang pendidikan', 'JP'],
  ['subject', 'Mata pelajaran', 'MP'],
  ['topic', 'Topik / bab', 'TB'],
  ['ptype', 'Tipe paket', 'TP'],
]

function MasterPage({
  data,
  setData,
  addLog,
  showToast,
  setModal,
}: {
  data: ReturnType<typeof initialSeed>
  setData: React.Dispatch<React.SetStateAction<ReturnType<typeof initialSeed>>>
  addLog: (uc: string, msg: string) => void
  showToast: (msg: string, bad?: boolean) => void
  setModal: (node: React.ReactNode | null) => void
}) {
  const [activeTab, setActiveTab] = useState<'level' | 'subject' | 'topic' | 'ptype'>('level')
  const [filterSubj, setFilterSubj] = useState('')
  const [newSubj, setNewSubj] = useState(() => Object.keys(SUBJECTS)[0] || 'mtk')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const [, label, pre] = MD_TABS.find((t) => t[0] === activeTab) || MD_TABS[0]

  const rows = useMemo(() => {
    if (activeTab === 'level') {
      return LEVELS.map((n) => ({
        key: n,
        name: n,
        used: data.questions.filter((q) => q.level === n).length,
        unit: 'soal',
      }))
    }
    if (activeTab === 'subject') {
      return Object.entries(SUBJECTS).map(([k, n]) => ({
        key: k,
        name: n,
        used: data.questions.filter((q) => q.subject === k).length,
        unit: 'soal',
        extra: `${(TOPICS[k] || []).length} topik`,
      }))
    }
    if (activeTab === 'topic') {
      return Object.entries(TOPICS)
        .flatMap(([k, arr]) =>
          arr.map((n) => ({
            key: `${k}|${n}`,
            name: n,
            subj: k,
            used: data.questions.filter((q) => q.subject === k && q.topic === n).length,
            unit: 'soal',
          }))
        )
        .filter((r) => !filterSubj || r.subj === filterSubj)
    }
    return PKG_TYPES.map((n) => ({
      key: n,
      name: n,
      used: data.packages.filter((p) => p.type === n).length,
      unit: 'paket',
    }))
  }, [activeTab, data.questions, data.packages, filterSubj])

  function validate(tab: string, rawName: string, subj: string | null, exceptKey: string | null): [string | null, string] {
    const trimmed = rawName.trim().replace(/\s+/g, ' ')
    if (!trimmed) return [null, 'Nama wajib diisi']
    if (trimmed.length < 2) return [null, 'Nama minimal 2 karakter']
    const pool =
      tab === 'topic' && subj
        ? (TOPICS[subj] || []).filter((n) => `${subj}|${n}` !== exceptKey)
        : tab === 'level'
        ? LEVELS.filter((n) => n !== exceptKey)
        : tab === 'subject'
        ? Object.values(SUBJECTS).filter((n) => n !== exceptKey && SUBJECTS[exceptKey || ''] !== n)
        : PKG_TYPES.filter((n) => n !== exceptKey)

    if (pool.some((n) => n.toLowerCase() === trimmed.toLowerCase())) {
      return [null, `"${trimmed}" sudah ada`]
    }
    return [trimmed, '']
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const [validated, err] = validate(activeTab, name, activeTab === 'topic' ? newSubj : null, null)
    if (err || !validated) {
      setError(err)
      return
    }

    if (activeTab === 'level') {
      LEVELS.push(validated)
    } else if (activeTab === 'subject') {
      let k = validated.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 8) || 'mp'
      while (SUBJECTS[k]) k += 'x'
      SUBJECTS[k] = validated
      TOPICS[k] = []
    } else if (activeTab === 'topic') {
      TOPICS[newSubj] = TOPICS[newSubj] || []
      TOPICS[newSubj].push(validated)
    } else {
      PKG_TYPES.push(validated)
    }

    addLog('MD', `${label} "${validated}" ditambahkan`)
    showToast(`"${validated}" ditambahkan`)
    setName('')
    // Trigger re-render
    setData((prev) => ({ ...prev }))
  }

  function handleRename(key: string, raw: string) {
    const subj = activeTab === 'topic' ? key.split('|')[0] : null
    const old =
      activeTab === 'topic'
        ? key.split('|').slice(1).join('|')
        : activeTab === 'subject'
        ? SUBJECTS[key]
        : key
    const [validated, err] = validate(activeTab, raw, subj, key)
    if (err || !validated) {
      showToast(err, true)
      return
    }
    if (validated === old) {
      setEditingKey(null)
      return
    }

    if (activeTab === 'level') {
      const idx = LEVELS.indexOf(old)
      if (idx !== -1) LEVELS[idx] = validated
      setData((prev) => ({
        ...prev,
        questions: prev.questions.map((q) => (q.level === old ? { ...q, level: validated } : q)),
      }))
    } else if (activeTab === 'subject') {
      SUBJECTS[key] = validated
      setData((prev) => ({ ...prev }))
    } else if (activeTab === 'topic') {
      if (subj && TOPICS[subj]) {
        const arr = TOPICS[subj]
        const idx = arr.indexOf(old)
        if (idx !== -1) arr[idx] = validated
      }
      setData((prev) => ({
        ...prev,
        questions: prev.questions.map((q) => (q.subject === subj && q.topic === old ? { ...q, topic: validated } : q)),
      }))
    } else {
      const idx = PKG_TYPES.indexOf(old)
      if (idx !== -1) PKG_TYPES[idx] = validated
      setData((prev) => ({
        ...prev,
        packages: prev.packages.map((p) => (p.type === old ? { ...p, type: validated } : p)),
      }))
    }

    setEditingKey(null)
    addLog('MD', `"${old}" diubah menjadi "${validated}"`)
    showToast('Perubahan disimpan')
  }

  function handleDelete(key: string) {
    const row = rows.find((r) => r.key === key)
    if (!row) return
    if (row.used > 0) {
      showToast(`Tidak dapat dihapus karena masih dipakai ${row.used} ${row.unit}`, true)
      return
    }

    setModal(
      <div className="scrim">
        <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="dlgT">
          <h2 id="dlgT">Hapus "{row.name}"?</h2>
          <p>Data ini akan dihapus dari pilihan di seluruh aplikasi.</p>
          <div className="dfoot">
            <button className="btn" onClick={() => setModal(null)} type="button">
              Batal
            </button>
            <button
              className="btn danger"
              onClick={() => {
                setModal(null)
                if (activeTab === 'level') {
                  const idx = LEVELS.indexOf(row.name)
                  if (idx !== -1) LEVELS.splice(idx, 1)
                } else if (activeTab === 'subject') {
                  delete SUBJECTS[key]
                  delete TOPICS[key]
                  if (filterSubj === key) setFilterSubj('')
                } else if (activeTab === 'topic') {
                  const s = key.split('|')[0]
                  if (TOPICS[s]) {
                    const idx = TOPICS[s].indexOf(row.name)
                    if (idx !== -1) TOPICS[s].splice(idx, 1)
                  }
                } else {
                  const idx = PKG_TYPES.indexOf(row.name)
                  if (idx !== -1) PKG_TYPES.splice(idx, 1)
                }
                addLog('MD', `"${row.name}" dihapus`)
                showToast(`"${row.name}" dihapus`)
                setData((prev) => ({ ...prev }))
              }}
              type="button"
            >
              Hapus
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
          <h1>Data master</h1>
          <p className="muted">Kelola jenjang pendidikan, mata pelajaran, topik, dan tipe paket yang dipakai di seluruh aplikasi.</p>
        </div>
      </div>

      <div className="tabs" role="tablist" aria-label="Jenis data master">
        {MD_TABS.map(([k, tabLabel]) => (
          <button
            key={k}
            id={`mdt-${k}`}
            className={`tab ${activeTab === k ? 'on' : ''}`}
            role="tab"
            aria-selected={activeTab === k}
            aria-controls="mdpanel"
            onClick={() => {
              setActiveTab(k as 'level' | 'subject' | 'topic' | 'ptype')
              setError('')
              setEditingKey(null)
            }}
            type="button"
          >
            {tabLabel}
          </button>
        ))}
      </div>

      <div id="mdpanel" role="tabpanel" aria-labelledby={`mdt-${activeTab}`} className="stack" style={{ gap: 'var(--s4)' }}>
        <form className="card stack" onSubmit={handleAdd} noValidate>
          <h2 className="h3">Tambah {label.toLowerCase()}</h2>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            {activeTab === 'topic' && (
              <label className="f" style={{ minWidth: 180 }}>
                Mata pelajaran
                <select value={newSubj} onChange={(e) => setNewSubj(e.target.value)}>
                  {Object.entries(SUBJECTS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="f" style={{ flex: 1, minWidth: 200 }}>
              Nama
              <input
                type="text"
                maxLength={60}
                autoComplete="off"
                placeholder={
                  activeTab === 'level'
                    ? 'Contoh: SMP Kelas 9'
                    : activeTab === 'subject'
                    ? 'Contoh: Kimia'
                    : activeTab === 'topic'
                    ? 'Contoh: Teorema Thales'
                    : 'Contoh: Try Out'
                }
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setError('')
                }}
                className={error ? 'invalid' : ''}
              />
              {error && (
                <span className="err" id="mdErr">
                  <svg className="ic" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 3 2 20h20z" />
                    <path d="M12 10v4M12 17h.01" />
                  </svg>
                  {error}
                </span>
              )}
            </label>
            <button className="btn primary" type="submit" style={{ marginTop: 24 }}>
              <svg className="ic" viewBox="0 0 24 24" aria-hidden="true">
                <path d="m5 12 5 5 9-10" />
              </svg>
              Tambah
            </button>
          </div>
        </form>

        <div className="row between">
          <span className="small muted" aria-live="polite">
            {rows.length} {label.toLowerCase()}
          </span>
          {activeTab === 'topic' && (
            <label className="row small" style={{ fontWeight: 600 }}>
              Saring
              <select
                value={filterSubj}
                onChange={(e) => {
                  setFilterSubj(e.target.value)
                  setEditingKey(null)
                }}
                style={{ minHeight: 36, width: 'auto' }}
              >
                <option value="">Semua mata pelajaran</option>
                {Object.entries(SUBJECTS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {rows.length > 0 ? (
          <div className="tw cards" tabIndex={0} role="region" aria-label={`Daftar ${label.toLowerCase()}`}>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nama</th>
                  {activeTab === 'topic' && <th>Mata pelajaran</th>}
                  {activeTab === 'subject' && <th>Topik</th>}
                  <th>Dipakai</th>
                  <th>
                    <span className="sr">Aksi</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const editing = editingKey === r.key
                  return (
                    <tr key={r.key}>
                      <td className="mono" data-label="ID">
                        {pre}-{String(i + 1).padStart(2, '0')}
                      </td>
                      <td className="full" data-label="Nama">
                        {editing ? (
                          <form
                            className="row"
                            onSubmit={(e) => {
                              e.preventDefault()
                              handleRename(r.key, editName)
                            }}
                            style={{ flexWrap: 'nowrap' }}
                          >
                            <label className="sr" htmlFor="mdEditName">
                              Nama baru
                            </label>
                            <input
                              id="mdEditName"
                              type="text"
                              maxLength={60}
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              autoFocus
                            />
                            <button className="btn sm primary" type="submit">
                              Simpan
                            </button>
                            <button className="btn sm" onClick={() => setEditingKey(null)} type="button">
                              Batal
                            </button>
                          </form>
                        ) : (
                          <b>{r.name}</b>
                        )}
                      </td>
                      {activeTab === 'topic' && (
                        <td data-label="Mata pelajaran">{SUBJECTS[(r as { subj?: string }).subj || ''] || '-'}</td>
                      )}
                      {activeTab === 'subject' && (
                        <td data-label="Topik">{(r as { extra?: string }).extra || '-'}</td>
                      )}
                      <td data-label="Dipakai">
                        {r.used ? (
                          <span className="chip c-info">{r.used} {r.unit}</span>
                        ) : (
                          <span className="chip c-idle">Belum dipakai</span>
                        )}
                      </td>
                      <td data-label="Aksi">
                        <div className="row" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                          {!editing && (
                            <>
                              <button
                                className="btn sm"
                                onClick={() => {
                                  setEditingKey(r.key)
                                  setEditName(r.name)
                                }}
                                type="button"
                                aria-label={`Ubah ${r.name}`}
                              >
                                <svg className="ic" viewBox="0 0 24 24" aria-hidden="true">
                                  <path d="M4 20h4L19 9l-4-4L4 16z" />
                                  <path d="m13.5 6.5 4 4" />
                                </svg>
                                Ubah
                              </button>
                              <button
                                className="btn sm danger"
                                onClick={() => handleDelete(r.key)}
                                type="button"
                                disabled={r.used > 0}
                                title={r.used > 0 ? `Masih dipakai ${r.used} ${r.unit}` : undefined}
                                aria-label={`Hapus ${r.name}`}
                              >
                                <svg className="ic" viewBox="0 0 24 24" aria-hidden="true">
                                  <path d="M4 7h16" />
                                  <path d="M9 7V4h6v3" />
                                  <path d="M6 7l1 13h10l1-13" />
                                </svg>
                                Hapus
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="card">
            <div className="empty has-ic">
              <span className="eic">
                <svg className="ic lg" viewBox="0 0 24 24" aria-hidden="true">
                  <ellipse cx="12" cy="5" rx="8" ry="3" />
                  <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
                  <path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
                </svg>
              </span>
              <b>Belum ada data</b>
              <span>
                {activeTab === 'topic' && filterSubj
                  ? 'Belum ada topik untuk mata pelajaran ini. Tambahkan melalui formulir di atas.'
                  : 'Tambahkan data pertama melalui formulir di atas.'}
              </span>
            </div>
          </div>
        )}
        <p className="xs muted">
          Data yang masih dipakai soal atau paket tidak dapat dihapus. Mengubah nama akan memperbarui semua soal dan paket terkait.
        </p>
      </div>
    </>
  )
}
