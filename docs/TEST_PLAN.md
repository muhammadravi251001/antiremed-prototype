# Test Plan

## Automated Tests

Run with `npm test`. Current automated coverage is focused on deterministic business rules:

| Test ID | Coverage | Current result |
|---|---|---|
| AT-01 | Generated option count, exactly one correct option, and explanations | Passed |
| AT-02 | Duplicate option labels and missing explanations are rejected | Passed |
| AT-03 | Package readiness requires questions, validation, and required media | Passed |
| AT-04 | Integer score calculation and hiding answer keys/explanations before submit | Passed |
| AT-05 | Editing preserves historical answer-option references; archiving required media demotes dependent ready packages | Passed |
| AT-06 | Package-type master CRUD, duplicate-name rejection, and package-type validation | Passed |

The automated suite currently has 16 passing tests across question invariants, review, package readiness, master data, historical answer integrity, media lifecycle, quiz integrity, distribution/payment simulation, and invalid uploads. Automated tests do not replace the manual HTTP/UI checks below. Run `npm run build` for the frontend and API TypeScript/build gate.

## Manual Test Cases

| Test ID | Requirement/use case | Prasyarat | Langkah pengujian | Expected result | Actual result | Status |
|---|---|---|---|---|---|---|
| MT-01 | UC-01, UC-02, AC-05, AC-06 | App running; master data seeded | Generate 1–10 questions with each option count | Saved `NEEDS_REVIEW` questions with valid options and explanations; demo label visible | — | Belum dijalankan |
| MT-02 | UC-03, AC-04, AC-07 | Seeded questions | Search and filter the question bank; edit and refresh | Filters match stored data; edited content persists; validated edit returns to review | — | Belum dijalankan |
| MT-03 | UC-04, AC-08 | At least one generated question | Open Review Soal | Full question, options, explanations, and media status are inspectable | — | Belum dijalankan |
| MT-04 | UC-05, AC-08, AC-10 | Question awaits review; required media resolved | Accept with confirmation, then try a required-media question without media | Eligible item becomes validated; unresolved required-media item cannot be accepted | — | Belum dijalankan |
| MT-05 | UC-06, AC-07 | A validated question | Change question text/options and save | Changes persist and status returns to `NEEDS_REVIEW` | — | Belum dijalankan |
| MT-06 | UC-07, AC-09 | Question awaits review | Reject without a reason, then reject with a reason | Empty reason is blocked; non-empty reason is stored with `REJECTED` | — | Belum dijalankan |
| MT-07 | UC-08, FR-06 | Question exists | Run media detection on visual and non-visual question text | Rules-based result is stored and visible | — | Belum dijalankan |
| MT-08 | UC-09, AC-11 | Media catalog seeded | Open media workspace and choose a question | Demo catalog is shown; search/candidate UI uses local assets only | — | Belum dijalankan |
| MT-09 | UC-10, UC-12, AC-11 | A question and media asset exist | Attach media, refresh, then detach through API/client workflow | Relation persists and media state updates | — | Belum dijalankan |
| MT-10 | UC-11 | Media workspace available | Simulate media generation | Locally stored media metadata is labeled simulated; no external AI call occurs | — | Belum dijalankan |
| MT-11 | UC-12, NFR security | Media workspace available | Upload valid image, oversized file, and non-image | Valid PNG/JPEG/WEBP stores locally; oversize/unsupported file is rejected | — | Belum dijalankan |
| MT-12 | UC-13, AC-10, AC-12 | At least one validated question | Create draft with validated and unvalidated IDs; attempt ready with missing media | Unvalidated/duplicate items are rejected; readiness follows backend rules | — | Belum dijalankan |
| MT-13 | UC-14, AC-13 | A ready package exists | Start as demo student, navigate options, and submit | Quiz works; answer keys are absent from pre-submit response | — | Belum dijalankan |
| MT-14 | UC-15, AC-14, AC-15 | An active attempt exists | Submit answers, including unanswered choices | Backend computes score, saves each answer once, rejects repeat submission | — | Belum dijalankan |
| MT-15 | UC-16 | A submitted attempt exists | Open results and detail | Stored score, answers, correct count, and wrong count are shown | — | Belum dijalankan |
| MT-16 | UC-17, UC-18, AC-16 | A submitted attempt exists | Preview and simulate distribution to student and parent via both channels | Distribution records persist; no message is sent externally | — | Belum dijalankan |
| MT-17 | UC-19, AC-17 | Payment demo page open | Create a transaction | A `PENDING` demo reference is stored; no financial data is requested | — | Belum dijalankan |
| MT-18 | UC-20, UC-21, AC-17 | A demo transaction exists | Simulate success, failure, and pending; refresh list | Status changes persist and are labeled as simulation | — | Belum dijalankan |
| MT-19 | FR-17, AC-02 | App running | Switch demo role; add unique and duplicate master data | Role selection persists locally; duplicate master name is rejected | — | Belum dijalankan |
| MT-20 | FR-18, FR-20, AC-01, AC-19, AC-23 | Fresh checkout | Follow README setup with no external credentials | Migrations, seed, API and browser app run locally with feedback states | — | Belum dijalankan |
| MT-21 | FR-19, AC-03 | Seeded database | Create/review/submit actions and inspect Dashboard | Dashboard totals come from DB and recent audit events appear | — | Belum dijalankan |

## Execution Notes

Record actual results only after running the corresponding manual case. The broader manual acceptance journey still needs execution.