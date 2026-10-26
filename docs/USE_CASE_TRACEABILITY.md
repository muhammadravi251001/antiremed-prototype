# Use Case Traceability

| UC ID | Nama use case | Business requirement | Halaman UI | API endpoint | Model database | Test case | Status implementasi |
|---|---|---|---|---|---|---|---|
| UC-01 | Membuat Soal dengan Generative AI | FR-02; parameter dan simpan hasil | Buat soal dengan AI | `POST /api/ai/generate-questions` | Question, AnswerOption, Topic, Subject | AT-01, MT-01 | Implemented, demo provider |
| UC-02 | Membuat Penjelasan Setiap Pilihan Jawaban | FR-03; penjelasan per opsi | Generator, editor, review | `POST /api/ai/generate-questions`; `PATCH /api/questions/:id` | AnswerOption | AT-01, AT-02, MT-01 | Implemented, demo content |
| UC-03 | Menyusun Soal Menjadi Struktur Data Terstandar | FR-04, FR-05 | Bank soal, editor | `POST /api/questions`; `GET /api/questions/:id` | Question, AnswerOption, EducationLevel, Subject, Topic | AT-01, MT-02 | Implemented |
| UC-04 | Melakukan Peninjauan Soal | FR-09 | Review soal | `GET /api/questions?status=NEEDS_REVIEW` | Question, AnswerOption, AuditLog | MT-03 | Implemented |
| UC-05 | Menerima Soal | FR-09, FR-10 | Review soal | `POST /api/questions/:id/review/accept` | Question, AuditLog | MT-04 | Implemented; acceptance guard enforced |
| UC-06 | Mengubah Soal | FR-09; edits to validated questions require review | Question editor | `PATCH /api/questions/:id` | Question, AnswerOption, AuditLog | MT-05 | Implemented |
| UC-07 | Menolak Soal | FR-09; rejection reason required | Review soal | `POST /api/questions/:id/review/reject` | Question, AuditLog | MT-06 | Implemented |
| UC-08 | Mendeteksi Kebutuhan Media Visual | FR-06 | Editor / media workspace | `POST /api/questions/:id/detect-media` | Question | MT-07 | Implemented, rules-based demo |
| UC-09 | Mencari Media Visual | FR-07; show local candidates | Media pembelajaran | `GET /api/media/candidates?questionId=...` | MediaAsset | MT-08 | Implemented, local catalog only |
| UC-10 | Menggunakan Media dari Repositori Antiremed | FR-07, FR-08 | Media pembelajaran | `POST /api/questions/:questionId/media` | MediaAsset, QuestionMedia, Question | MT-09 | Implemented |
| UC-11 | Menghasilkan Media Visual dengan AI | FR-07; adapter must be simulated | Media pembelajaran | `POST /api/ai/generate-media` | MediaAsset | MT-10 | Implemented, simulated metadata only |
| UC-12 | Menyimpan Media Secara Otomatis | FR-07, FR-08 | Media pembelajaran | `POST /api/media/upload`; `POST /api/questions/:questionId/media` | MediaAsset, QuestionMedia | MT-11 | Implemented, local upload |
| UC-13 | Membuat Paket Soal | FR-10, FR-11 | Paket soal | `POST /api/packages`; `POST /api/packages/:id/ready` | PackageType, QuestionPackage, PackageQuestion, Question | AT-03, MT-12 | Implemented |
| UC-14 | Mengerjakan Paket Soal | FR-12 | Kuis siswa | `GET /api/quiz/packages`; `POST /api/quiz/attempts`; `GET /api/quiz/attempts/:id/questions` | QuestionPackage, PackageQuestion, QuizAttempt | AT-04, MT-13 | Implemented |
| UC-15 | Menyimpan Hasil Pengerjaan Siswa | FR-13 | Kuis siswa, hasil belajar | `POST /api/quiz/attempts/:id/submit` | QuizAttempt, StudentAnswer | AT-04, MT-14 | Implemented; score computed server-side |
| UC-16 | Menyusun Informasi Hasil Pembelajaran | FR-14 | Hasil belajar | `GET /api/results`; `GET /api/results/:attemptId` | QuizAttempt, StudentAnswer, Question | MT-15 | Implemented |
| UC-17 | Mengirim Hasil kepada Siswa | FR-15; simulation only | Distribusi hasil | `POST /api/results/:attemptId/distributions` | ResultDistribution, QuizAttempt | MT-16 | Implemented, no external message sent |
| UC-18 | Mengirim Hasil kepada Orang Tua | FR-15; simulation only | Distribusi hasil | `POST /api/results/:attemptId/distributions` | ResultDistribution, QuizAttempt | MT-16 | Implemented, no external message sent |
| UC-19 | Melakukan Pembayaran Digital | FR-16; future scope demonstration | Pembayaran demo | `POST /api/payments` | PaymentTransaction | MT-17 | Simulated future scope |
| UC-20 | Memproses Pembayaran | FR-16; no gateway | Pembayaran demo | `POST /api/payments/:id/simulate-success`; `.../simulate-failure`; `.../simulate-pending` | PaymentTransaction | MT-18 | Simulated future scope |
| UC-21 | Mengonfirmasi Status Pembayaran | FR-16; persisted demo status | Pembayaran demo | `GET /api/payments`; `GET /api/payments/:id` | PaymentTransaction, AuditLog | MT-18 | Simulated future scope |

`AT-*` are automated domain tests in `tests/domain.test.ts`. `MT-*` are manual cases in [TEST_PLAN.md](TEST_PLAN.md); cases are marked pending until actually executed. A provider marked simulated is not a live external integration.