# Antiremed Academic Working Prototype

Local-first web prototype for AI-assisted question authoring, human review, educational media management, question packages, student quizzes, learning outcomes, and simulated distribution/payment.

All generated content is a deterministic demo. It is not a live AI integration, and generated questions must be reviewed by an instructor. Email, WhatsApp, and payment are simulations only.

## Requirements

- Node.js 20+ and npm 8+. Node 22 LTS is recommended. This workspace was built and tested with Node 16.14, but React Router 7 declares Node 20+ and npm emits engine warnings on Node 16; use Node 20+ for supported operation.
- A current browser and local disk space for SQLite and uploaded images.
- No API keys or external accounts.

## Setup

```powershell
npm install
Copy-Item .env.example .env
npm run db:migrate
npm run db:seed
npm run dev
```

The browser app is available at `http://localhost:5173`. Express listens on `http://localhost:4000`; Vite proxies `/api` and `/uploads` during development. The database is `prisma/dev.db`; local uploads are stored under `uploads/`.

`npm run db:migrate` creates/applies the initial SQLite migration. To restore all demo records later, use `npm run db:reset`. Reset replaces local database content but does not delete uploaded files.

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Run the API and Vite development server together |
| `npm run dev:api` | Run only the API in watch mode |
| `npm run dev:web` | Run only the Vite frontend |
| `npm run db:generate` | Generate Prisma Client |
| `npm run db:migrate` | Apply/create the local migration |
| `npm run db:seed` | Replace database content with demo seed data |
| `npm run db:reset` | Reset/migrate and reseed the database |
| `npm test` | Run automated unit and API tests |
| `npm run build` | Type-check API and frontend, then create the web production bundle |
| `npm run lint` | Run ESLint for the frontend source |

## Main Demo Path

1. Open **Buat dengan AI**, choose taxonomy and generation settings, and create questions.
2. Open **Review soal** to edit, accept, or reject. Rejection requires a reason; unresolved required media blocks acceptance.
3. Add local images or simulated media in **Media pembelajaran**, then associate an asset with a question.
4. Create a package from validated questions and mark it ready when the server-side checks pass.
5. Open **Kuis siswa**, start a demo attempt, and submit answers. The API calculates the score and only returns correctness after submission.
6. Inspect **Hasil belajar** and simulate delivery to a student or parent.
7. Open **Pembayaran demo** to create and transition a simulated transaction.

## Architecture and Documentation

The application is a modular monolith: React/Vite → Express REST API → Prisma → SQLite, with a local upload directory and local demo adapters. See [deployment](docs/DEPLOYMENT.md), [PRD summary](docs/PRD.md), [use-case traceability](docs/USE_CASE_TRACEABILITY.md), [test plan](docs/TEST_PLAN.md), and [migration plan](docs/MIGRATION_PLAN.md).

The traceability matrix covers UC-01 through UC-21. UC-19 through UC-21 are explicitly future scope and simulation only.

## Prototype Limitations

- Demo role selection is not authentication or authorization.
- Question/media generation is deterministic placeholder content and requires academic review.
- Simulated visual generation creates metadata only; no AI image service is called.
- Media search is limited to the local catalog; uploads accept PNG, JPEG, and WEBP up to 5 MB.
- Email/WhatsApp distribution and payment status do not contact external providers.
- Use synthetic student display names only. This prototype is not production-hardened.
- `npm audit --omit=dev` reports no runtime advisories. The full audit still reports development-tool advisories in the Node-16-compatible Vite 4 / Vitest 0.34 toolchain; do not expose the development server to untrusted networks. Upgrade the dev toolchain when moving to the supported Node 20+ environment.

## Verification Record

The current automated suite has 16 passing tests covering question invariants, API lifecycle, package/media readiness, master data, historical answer integrity, quiz score and key redaction, distribution/payment simulations, and upload validation. The broader manual scenarios are listed in `docs/TEST_PLAN.md` and remain unrun until a tester records actual results. Build and test results are reported by the implementation session; rerun `npm test` and `npm run build` after local changes.