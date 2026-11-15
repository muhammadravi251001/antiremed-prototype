export type Role = 'teacher' | 'student' | 'payer'

export type Master = { id: string; name: string; code?: string; subjectId?: string; subject?: { name: string } }
export type Option = { id?: string; label: string; text: string; isCorrect: boolean; explanation: string; sortOrder?: number }
export type MediaItem = { id: string; title: string; img?: string; filePath?: string; source: string; rights: string; status: string; tags: string[] }
export type QuestionItem = {
  id: string
  subject: string
  subjectId?: string
  level: string
  educationLevelId?: string
  topic: string
  topicId?: string
  difficulty: string
  text: string
  options: Option[]
  concept?: string
  status: 'Draft' | 'InReview' | 'RevisionRequired' | 'Accepted' | 'Rejected'
  mediaReq: 'NotRequired' | 'Required' | 'NeedsCheck' | 'Fulfilled'
  mediaIds: string[]
  version: number
  source: string
  flags: string[]
  history: { at: string; by: string; d: string; c: string }[]
  createdAt: string
}
export type PackageItem = {
  id: string
  title: string
  type: string
  status: 'Draft' | 'Ready'
  price: number
  qids: string[]
  createdAt: string
}
export type StudentItem = { id: string; name: string; level: string; minor: boolean; consent: string | null; phone: string; email: string; parents: string[] }
export type ParentItem = { id: string; name: string; phone: string; email: string; children: string[] }
export type AttemptItem = { id: string; pid: string; studentId: string; total: number; correct: number; score: number; ans: Record<string, string>; at: string; status: 'Stored' | 'Unmatched' }
export type ResultItem = { id: string; attId: string; studentId: string; pid: string; score: number; summary: string; at: string }
export type DeliveryItem = { id: string; rid: string; kind: 'student' | 'parent'; to: string | null; toName: string; channel: string; status: 'Sent' | 'Failed' | 'Held'; reason: string; at: string }
export type PaymentItem = { id: string; userId: string; studentId: string; packageId: string; amount: number; status: 'Created' | 'Pending' | 'Paid' | 'Failed' | 'Cancelled'; createdAt: string; expiresAtMs: number; ref: string | null; reason?: string }
export type ConfirmationItem = { id: string; paymentId: string; source: string; provider: string; state: string; at: string; note: string }
export type LogItem = { t: string; uc: string; msg: string }

export type SimulationSettings = {
  ai: 'success' | 'fail'
  explain: 'complete' | 'incomplete'
  detect: 'auto' | 'Required' | 'NeedsCheck' | 'NotRequired'
  repo: 'found' | 'none'
  ext: 'found' | 'none' | 'down'
  img: 'success' | 'fail'
  upload: 'success' | 'fail'
  submit: 'success' | 'fail'
  match: 'match' | 'mismatch'
  stuContact: 'auto' | 'missing'
  parentLink: 'auto' | 'unverified'
  channel: 'sent' | 'fail'
  qris: 'ok' | 'rejected'
}

export type SimPaySettings = {
  status: 'SUCCESS' | 'PENDING' | 'FAILED'
  variant: 'valid' | 'amount' | 'mismatch'
}

export type PipelineState = {
  p: { subject: string; level: string; topic: string; count: number; diff: string }
  steps: ('wait' | 'run' | 'done' | 'fail' | 'warn')[]
  notes: string[]
  state: 'run' | 'done' | 'fail'
  ids: string[]
  warn?: string
}

export type ActiveAttemptState = {
  pid: string
  i: number
  ans: Record<string, string>
  err: boolean
  sending?: boolean
}

export type MediaCandidate = {
  title: string
  img: string
  source: string
  rights: string
  ok: boolean
  existing?: string
  ai?: boolean
}

export const SUBJECTS: Record<string, string> = { mtk: 'Matematika', fis: 'Fisika', bio: 'Biologi' }
export const CAT: Record<string, string> = {
  'UC-01': 'Pembuatan soal',
  'UC-02': 'Pembuatan soal',
  'UC-03': 'Pembuatan soal',
  'UC-04': 'Peninjauan',
  'UC-05': 'Peninjauan',
  'UC-06': 'Peninjauan',
  'UC-07': 'Peninjauan',
  'UC-08': 'Media',
  'UC-09': 'Media',
  'UC-10': 'Media',
  'UC-11': 'Media',
  'UC-12': 'Media',
  'UC-13': 'Paket',
  'UC-14': 'Kuis',
  'UC-15': 'Kuis',
  'UC-16': 'Laporan belajar',
  'UC-17': 'Laporan belajar',
  'UC-18': 'Laporan belajar',
  'UC-19': 'Pembayaran',
  'UC-20': 'Pembayaran',
  'UC-21': 'Pembayaran',
}

export const USERS: Record<string, { role: Role; name: string; short: string; title: string }> = {
  'rina.wulandari@antiremed.id': { role: 'teacher', name: 'Rina Wulandari', short: 'Rina Wulandari', title: 'Pengajar Matematika' },
  'dimas.pratama@siswa.antiremed.id': { role: 'student', name: 'Dimas Pratama', short: 'Dimas', title: 'Siswa SMP Kelas 8' },
  'sari.pratama@email.co.id': { role: 'payer', name: 'Sari Pratama', short: 'Ibu Sari', title: 'Orang tua Dimas' },
}
export const LEVELS = ['SD Kelas 5', 'SMP Kelas 8', 'SMA Kelas 10', 'SMA Kelas 11', 'SMA Kelas 12 (SNBT)']
export const TOPICS: Record<string, string[]> = {
  mtk: ['Teorema Pythagoras', 'Statistika', 'Persamaan Linear'],
  fis: ['Gerak Parabola', 'Hukum Newton'],
  bio: ['Struktur Sel', 'Sistem Pencernaan'],
}
export const PKG_TYPES = ['Latihan', 'Ulangan Harian', 'Ujian Tengah Semester', 'Ujian Semester', 'TKA', 'SNBT']

export const QS_LABEL: Record<string, string> = { Draft: 'Draf', InReview: 'Menunggu Peninjauan', RevisionRequired: 'Perlu Revisi', Accepted: 'Tervalidasi', Rejected: 'Ditolak' }
export const QS_CLS: Record<string, string> = { Draft: 'c-idle', InReview: 'c-mark', RevisionRequired: 'c-bad', Accepted: 'c-ok', Rejected: 'c-idle' }
export const MR_LABEL: Record<string, string> = { NotRequired: 'Tanpa media', Required: 'Butuh media', NeedsCheck: 'Perlu dicek', Fulfilled: 'Media terpenuhi' }
export const MR_CLS: Record<string, string> = { NotRequired: 'c-idle', Required: 'c-bad', NeedsCheck: 'c-mark', Fulfilled: 'c-ok' }
export const MS_LABEL: Record<string, string> = { Requested: 'Diminta', Searching: 'Mencari', Generating: 'Dibuat AI', PendingReview: 'Menunggu tinjauan', Approved: 'Disetujui', Linked: 'Tertaut', Unavailable: 'Tidak tersedia', Archived: 'Diarsipkan' }
export const MS_CLS: Record<string, string> = { Requested: 'c-idle', Searching: 'c-info', Generating: 'c-info', PendingReview: 'c-mark', Approved: 'c-acc', Linked: 'c-ok', Unavailable: 'c-bad', Archived: 'c-idle' }
export const PAY_LABEL: Record<string, string> = { Created: 'Menunggu pembayaran', Pending: 'Sedang diproses', Paid: 'Berhasil', Failed: 'Gagal', Cancelled: 'Dibatalkan' }
export const PAY_CLS: Record<string, string> = { Created: 'c-info', Pending: 'c-mark', Paid: 'c-ok', Failed: 'c-bad', Cancelled: 'c-idle' }
export const DL_LABEL: Record<string, string> = { Sent: 'Terkirim', Failed: 'Gagal', Held: 'Ditahan' }
export const DL_CLS: Record<string, string> = { Sent: 'c-ok', Failed: 'c-bad', Held: 'c-mark' }

export function svg(body: string, w = 240, h = 180): string {
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" font-family="Arial" font-size="13"><rect width="${w}" height="${h}" fill="#fff"/>${body}</svg>`)
}

export const IMG: Record<string, string> = {
  tri: svg('<polygon points="40,150 200,150 40,40" fill="#E6F2EE" stroke="#1D6B58" stroke-width="2"/><rect x="40" y="136" width="14" height="14" fill="none" stroke="#1D6B58"/><text x="28" y="36">A</text><text x="24" y="166">B</text><text x="204" y="166">C</text><text x="12" y="100">5 cm</text><text x="100" y="170">12 cm</text>'),
  tri2: svg('<polygon points="50,140 190,140 50,50" fill="#F3F3F3" stroke="#333" stroke-width="2"/><text x="36" y="46">A</text><text x="36" y="156">B</text><text x="194" y="156">C</text>'),
  tri3: svg('<polygon points="30,150 210,150 30,30" fill="#FFF7E0" stroke="#C98A0B" stroke-width="2"/><rect x="30" y="136" width="14" height="14" fill="none" stroke="#C98A0B"/><text x="18" y="26">A</text><text x="16" y="166">B</text><text x="214" y="166">C</text><text x="4" y="95">AB</text><text x="110" y="168">BC</text><text x="160" y="40" fill="#999">AI</text>'),
  para: svg('<line x1="20" y1="160" x2="230" y2="160" stroke="#333"/><path d="M20 160 Q125 -20 230 160" fill="none" stroke="#2B57A0" stroke-width="2.5"/><circle cx="125" cy="70" r="5" fill="#B3261E"/><text x="132" y="66">P</text><circle cx="70" cy="105" r="4" fill="#333"/><text x="56" y="100">Q</text><circle cx="185" cy="110" r="4" fill="#333"/><text x="190" y="106">R</text>'),
  cell: svg('<ellipse cx="120" cy="90" rx="100" ry="70" fill="#EAF6EE" stroke="#25744A" stroke-width="2"/><circle cx="110" cy="85" r="22" fill="#CFE6D7" stroke="#25744A"/><ellipse cx="175" cy="70" rx="20" ry="9" fill="#F5D7C9" stroke="#B3261E"/><line x1="175" y1="70" x2="220" y2="30" stroke="#333"/><text x="222" y="28">X</text>'),
  bar: svg('<line x1="30" y1="150" x2="220" y2="150" stroke="#333"/><rect x="45" y="90" width="26" height="60" fill="#2B57A0"/><rect x="85" y="60" width="26" height="90" fill="#2B57A0"/><rect x="125" y="110" width="26" height="40" fill="#2B57A0"/><rect x="165" y="75" width="26" height="75" fill="#2B57A0"/>'),
}

export const POOL: Record<string, { text: string; o: string[]; c: number; mr: 'NotRequired' | 'Required' | 'NeedsCheck' | 'Fulfilled'; e: string[]; con: string }[]> = {
  mtk: [
    { text: 'Sebuah segitiga siku-siku memiliki sisi tegak 6 cm dan 8 cm. Panjang sisi miringnya adalah ...', o: ['10 cm', '12 cm', '14 cm', '7 cm', '9 cm'], c: 0, mr: 'NotRequired', e: ['Benar. √(6² + 8²) = √100 = 10 cm.', 'Salah. 12 cm diperoleh jika 6 dan 8 hanya dijumlah lalu dikurangi 2, bukan rumus Pythagoras.', 'Salah. 14 cm adalah 6 + 8, penjumlahan biasa.', 'Salah. 7 cm lebih pendek dari sisi tegak 8 cm; sisi miring selalu terpanjang.', 'Salah. 9 cm tidak memenuhi 6² + 8² = c².'], con: 'Teorema Pythagoras: c² = a² + b².' },
    { text: 'Perhatikan gambar segitiga ABC. Jika AB = 5 cm dan BC = 12 cm, panjang AC adalah ...', o: ['13 cm', '17 cm', '11 cm', '15 cm', '7 cm'], c: 0, mr: 'Required', e: ['Benar. AC = √(5² + 12²) = √169 = 13 cm.', 'Salah. 17 cm adalah AB + BC.', 'Salah. √(12² − 5²) ≈ 10,9 bukan untuk sisi miring.', 'Salah. 15 cm tidak memenuhi 5² + 12² = 169.', 'Salah. 7 cm adalah selisih BC − AB.'], con: 'Sisi miring berhadapan dengan sudut siku-siku.' },
    { text: 'Tripel Pythagoras di bawah ini yang benar adalah ...', o: ['5, 12, 13', '4, 5, 6', '6, 7, 9', '3, 5, 7', '2, 3, 4'], c: 0, mr: 'NotRequired', e: ['Benar. 5² + 12² = 25 + 144 = 169 = 13².', 'Salah. 16 + 25 = 41 ≠ 36.', 'Salah. 36 + 49 = 85 ≠ 81.', 'Salah. 9 + 25 = 34 ≠ 49.', 'Salah. 4 + 9 = 13 ≠ 16.'], con: 'Tripel Pythagoras memenuhi a² + b² = c².' },
    { text: 'Sebuah tangga sepanjang 13 m bersandar pada tembok. Jarak kaki tangga ke tembok 5 m. Tinggi ujung tangga dari lantai adalah ...', o: ['12 m', '8 m', '18 m', '10 m', '14 m'], c: 0, mr: 'NeedsCheck', e: ['Benar. √(13² − 5²) = √144 = 12 m.', 'Salah. 8 m adalah 13 − 5.', 'Salah. 18 m adalah 13 + 5.', 'Salah. 10 m tidak memenuhi 10² + 5² = 13².', 'Salah. 14 m lebih panjang dari tangga.'], con: 'Mencari sisi tegak: b = √(c² − a²).' },
    { text: 'Diagram batang menunjukkan nilai ulangan empat kelompok. Kelompok dengan nilai tertinggi adalah ...', o: ['Kelompok 2', 'Kelompok 1', 'Kelompok 3', 'Kelompok 4', 'Semua sama'], c: 0, mr: 'Required', e: ['Benar. Batang kedua paling tinggi.', 'Salah. Batang pertama lebih rendah dari batang kedua.', 'Salah. Batang ketiga terendah.', 'Salah. Batang keempat di bawah batang kedua.', 'Salah. Tinggi batang berbeda.'], con: 'Membaca diagram batang.' },
  ],
  fis: [
    { text: 'Sebuah bola ditendang dengan kecepatan awal 20 m/s dan sudut elevasi 30°. Jika g = 10 m/s², waktu untuk mencapai titik tertinggi adalah ...', o: ['1 s', '2 s', '√3 s', '0,5 s', '4 s'], c: 0, mr: 'NotRequired', e: ['Benar. t = v₀ sin θ / g = 20 × 0,5 / 10 = 1 s.', 'Salah. 2 s adalah waktu total di udara.', 'Salah. √3 s muncul jika memakai cos 30°.', 'Salah. 0,5 s hanya sin 30°.', 'Salah. 4 s adalah 2 kali waktu total.'], con: 'Pada titik tertinggi, vy = 0.' },
    { text: 'Perhatikan lintasan gerak parabola pada gambar. Titik yang menunjukkan kecepatan vertikal bernilai nol adalah ...', o: ['P', 'Q', 'R', 'Titik awal', 'Titik akhir'], c: 0, mr: 'Required', e: ['Benar. P adalah titik tertinggi, vy = 0.', 'Salah. Di Q benda masih naik.', 'Salah. Di R benda sedang turun.', 'Salah. Di titik awal vy = v₀ sin θ.', 'Salah. Di titik akhir vy = −v₀ sin θ.'], con: 'Komponen vertikal kecepatan nol di puncak.' },
  ],
  bio: [
    { text: 'Organel yang berfungsi sebagai tempat respirasi sel adalah ...', o: ['Mitokondria', 'Ribosom', 'Badan Golgi', 'Lisosom', 'Vakuola'], c: 0, mr: 'NotRequired', e: ['Benar. Mitokondria menghasilkan ATP melalui respirasi sel.', 'Salah. Ribosom tempat sintesis protein.', 'Salah. Badan Golgi mengemas protein.', 'Salah. Lisosom mencerna zat.', 'Salah. Vakuola menyimpan cadangan makanan dan air.'], con: 'Fungsi organel sel.' },
    { text: 'Perhatikan gambar sel berikut. Bagian yang ditunjuk huruf X adalah ...', o: ['Mitokondria', 'Inti sel', 'Membran sel', 'Kloroplas', 'Retikulum endoplasma'], c: 0, mr: 'Required', e: ['Benar. Bentuk lonjong dengan krista adalah mitokondria.', 'Salah. Inti sel berbentuk bulat di tengah.', 'Salah. Membran adalah batas luar sel.', 'Salah. Kloroplas hanya pada sel tumbuhan dan berwarna hijau.', 'Salah. RE berbentuk saluran berlipat.'], con: 'Identifikasi organel dari gambar.' },
  ],
}

export function mkQ(id: string, subj: string, level: string, topic: string, p: typeof POOL['mtk'][0], status: QuestionItem['status'], extra: Partial<QuestionItem> = {}): QuestionItem {
  return {
    id,
    subject: subj,
    level,
    topic,
    difficulty: 'Sedang',
    text: p.text,
    options: p.o.map((t, i) => ({ label: 'ABCDE'[i], text: t, isCorrect: i === p.c, explanation: p.e[i] })),
    concept: p.con,
    status,
    mediaReq: p.mr,
    mediaIds: [],
    version: 1,
    source: 'Generative AI',
    flags: [],
    history: [],
    createdAt: '2026-10-20 09:10',
    ...extra,
  }
}

export function initialSeed() {
  const q: QuestionItem[] = []
  q.push(mkQ('Q-1001', 'mtk', 'SMP Kelas 8', 'Teorema Pythagoras', POOL.mtk[0], 'Accepted', { history: [{ at: '2026-10-20 10:02', by: 'Bu Rina', d: 'Terima', c: '' }] }))
  q.push(mkQ('Q-1002', 'mtk', 'SMP Kelas 8', 'Teorema Pythagoras', POOL.mtk[2], 'Accepted', { history: [{ at: '2026-10-20 10:05', by: 'Bu Rina', d: 'Terima', c: '' }] }))
  q.push(mkQ('Q-1003', 'mtk', 'SMP Kelas 8', 'Teorema Pythagoras', POOL.mtk[1], 'Accepted', { mediaReq: 'Fulfilled', mediaIds: ['M-201'], history: [{ at: '2026-10-20 10:11', by: 'Bu Rina', d: 'Terima', c: 'Gambar sudah sesuai' }] }))
  q.push(mkQ('Q-1004', 'mtk', 'SMP Kelas 8', 'Teorema Pythagoras', POOL.mtk[3], 'InReview'))
  q.push(mkQ('Q-1005', 'fis', 'SMA Kelas 10', 'Gerak Parabola', POOL.fis[1], 'InReview'))
  q.push(mkQ('Q-1006', 'fis', 'SMA Kelas 10', 'Gerak Parabola', POOL.fis[0], 'InReview'))
  const q7 = mkQ('Q-1007', 'bio', 'SMA Kelas 11', 'Struktur Sel', POOL.bio[0], 'RevisionRequired', { flags: ['Penjelasan opsi D kosong'] })
  q7.options[3].explanation = ''
  q.push(q7)
  q.push(mkQ('Q-1008', 'bio', 'SMA Kelas 11', 'Struktur Sel', POOL.bio[1], 'Rejected', { history: [{ at: '2026-10-21 14:30', by: 'Bu Rina', d: 'Tolak', c: 'Gambar organel tidak jelas dan opsi E ambigu' }] }))
  q.push(mkQ('Q-1009', 'mtk', 'SMP Kelas 8', 'Statistika', POOL.mtk[4], 'Draft', { flags: ['Menunggu deteksi media'] }))

  const media: MediaItem[] = [
    { id: 'M-201', title: 'Segitiga siku-siku ABC (AB 5, BC 12)', img: IMG.tri, source: 'Repositori internal', rights: 'Milik Antiremed', status: 'Linked', tags: ['pythagoras', 'segitiga'] },
    { id: 'M-202', title: 'Lintasan parabola titik P, Q, R', img: IMG.para, source: 'Repositori internal', rights: 'Milik Antiremed', status: 'Approved', tags: ['parabola', 'lintasan'] },
    { id: 'M-203', title: 'Diagram batang empat kelompok', img: IMG.bar, source: 'Repositori internal', rights: 'Milik Antiremed', status: 'Approved', tags: ['statistika', 'diagram batang'] },
    { id: 'M-204', title: 'Sel hewan dengan penanda X', img: IMG.cell, source: 'Repositori internal', rights: 'Milik Antiremed', status: 'Archived', tags: ['sel', 'organel'] },
  ]

  const packages: PackageItem[] = [
    { id: 'P-301', title: 'Latihan Pythagoras Kelas 8', type: 'Latihan', status: 'Ready', price: 25000, qids: ['Q-1001', 'Q-1002', 'Q-1003'], createdAt: '2026-10-21' },
    { id: 'P-302', title: 'Ulangan Harian Gerak Parabola', type: 'Ulangan Harian', status: 'Draft', price: 0, qids: ['Q-1006'], createdAt: '2026-10-22' },
  ]

  const students: StudentItem[] = [
    { id: 'U-11', name: 'Dimas Pratama', level: 'SMP Kelas 8', minor: true, consent: '2026-08-01', phone: '0812-xxxx-1021', email: 'dimas@contoh.id', parents: ['U-21'] },
    { id: 'U-12', name: 'Nadia Putri', level: 'SMP Kelas 8', minor: true, consent: '2026-08-03', phone: '', email: '', parents: ['U-22'] },
    { id: 'U-13', name: 'Raka Aditya', level: 'SMP Kelas 8', minor: true, consent: null, phone: '0813-xxxx-3381', email: 'raka@contoh.id', parents: [] },
  ]

  const parents: ParentItem[] = [
    { id: 'U-21', name: 'Ibu Sari Pratama', phone: '0811-xxxx-7781', email: 'sari@contoh.id', children: ['U-11'] },
    { id: 'U-22', name: 'Bapak Hendra', phone: '0815-xxxx-4410', email: '', children: ['U-12'] },
  ]

  const access = [{ id: 'A-01', studentId: 'U-11', packageId: 'P-301', status: 'Active', via: 'PAY-0901' }]
  const payments: PaymentItem[] = [
    { id: 'PAY-0901', userId: 'U-21', studentId: 'U-11', packageId: 'P-301', amount: 25000, status: 'Paid', createdAt: '2026-10-22 19:04', expiresAtMs: Date.now() + 15 * 60000, ref: 'QR-88F1' },
  ]
  const confirmations: ConfirmationItem[] = [
    { id: 'CF-01', paymentId: 'PAY-0901', source: 'notifikasi', provider: 'SUCCESS', state: 'Notified', at: '2026-10-22 19:06', note: 'Data cocok' },
  ]
  const log: LogItem[] = [
    { t: '2026-10-22 19:06', uc: 'UC-21', msg: 'PAY-0901 terverifikasi SUCCESS, akses P-301 aktif untuk Dimas Pratama' },
  ]

  return {
    questions: q,
    media,
    packages,
    students,
    parents,
    access,
    attempts: [] as AttemptItem[],
    results: [] as ResultItem[],
    deliveries: [] as DeliveryItem[],
    payments,
    confirmations,
    log,
    seq: { q: 1010, m: 205, p: 303, pay: 902, a: 1, r: 1, d: 1, cf: 2, acc: 2 },
  }
}

export const now = () => {
  const d = new Date()
  const p = (x: number) => String(x).padStart(2, '0')
  return `2026-10-27 ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}
export const rp = (n: number) => 'Rp' + Number(n || 0).toLocaleString('id-ID')
export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function checkIssues(q: QuestionItem): string[] {
  const out: string[] = []
  if (!q.text.trim()) out.push('Teks pertanyaan kosong')
  if (q.options.length < 2) out.push('Minimal dua pilihan jawaban')
  if (q.options.some((o) => !o.text.trim())) out.push('Ada pilihan jawaban kosong')
  const k = q.options.filter((o) => o.isCorrect).length
  if (k !== 1) out.push('Harus ada tepat satu jawaban benar')
  q.options.forEach((o) => {
    if (!o.explanation.trim()) out.push(`Penjelasan opsi ${o.label} kosong`)
  })
  if (q.mediaReq === 'Required') out.push('Kebutuhan media belum terpenuhi')
  if (q.mediaReq === 'NeedsCheck') out.push('Kebutuhan media perlu dipastikan')
  return out
}

export function qrSvg(seed: string): string {
  let h = 0
  for (const c of seed) h = ((h * 31 + c.charCodeAt(0)) >>> 0)
  const n = 25, s = 8
  let r = ''
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      h = ((h * 1103515245 + 12345) >>> 0)
      const fin = (x < 7 && y < 7) || (x > n - 8 && y < 7) || (x < 7 && y > n - 8)
      const on = fin ? ((x % 6 === 0 || y % 6 === 0 || (x > 1 && x < 5 && y > 1 && y < 5))) : (h >> 16) & 1
      if (fin) {
        const fx = x < 7 ? x : x - (n - 7), fy = y < 7 ? y : y - (n - 7)
        const v = (fx === 0 || fx === 6 || fy === 0 || fy === 6 || (fx >= 2 && fx <= 4 && fy >= 2 && fy <= 4))
        if (v) r += `<rect x="${x * s}" y="${y * s}" width="${s}" height="${s}"/>`
      } else if (on) {
        r += `<rect x="${x * s}" y="${y * s}" width="${s}" height="${s}"/>`
      }
    }
  }
  return `<svg class="qr" viewBox="0 0 ${n * s} ${n * s}" role="img" aria-label="Kode QR simulasi"><g fill="#111">${r}</g></svg>`
}

