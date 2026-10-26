# Antiremed Academic Prototype

## Product Goal

Build a local-first academic working prototype for authoring, reviewing, classifying, and assembling educational multiple-choice questions, managing associated media, running student quizzes, and viewing learning results. The instructor remains accountable for reviewing all generated content.

## Users

- **Administrator:** demo role with the same prototype access as an instructor.
- **Instructor / reviewer:** generates, edits, accepts, rejects, and organizes questions; manages media and packages; reviews learning outcomes.
- **Student:** uses a demo display name to take a ready package and view the submitted score.
- **Parent:** recipient of simulated result distribution; no parent account is required.

Role selection is a local prototype convenience, not authentication or authorization.

## Scope

The prototype covers a database-backed dashboard, question repository and editor, simulated question/media generation, review queue, local media upload and association, package builder, student quiz, server-calculated result, simulated result distribution, simulated payment, taxonomy management, audit activity, seed/reset, and implementation documentation.

UC-19 through UC-21 are future scope and are shown only as a payment-state simulation. No real AI provider, media search provider, Drive, email, WhatsApp, QRIS, or payment gateway is contacted.

## Core Rules

1. Generated questions are stored as `NEEDS_REVIEW`; generation never validates or publishes them.
2. A question has four or five uniquely labeled options, exactly one correct answer, and an explanation for each option.
3. Editing a validated question returns it to `NEEDS_REVIEW`.
4. Rejection requires a reason.
5. Only validated questions can enter a package. A package requires at least one question and all required media must be linked or explicitly excluded with a reason before it is marked ready.
6. Quiz answer keys and explanations are withheld until submission. The API calculates and stores the score.
7. Distribution and payment actions persist local simulation states and are labeled as simulations.

## Technical Decisions

- React, TypeScript, Vite, React Router, and Tailwind CSS for the browser application.
- Express REST API, Zod request validation, Prisma ORM, and local SQLite.
- Local uploaded files live under `uploads/`; external adapters are represented by deterministic demo providers.
- Prisma 5 with SQLite stores enum-like statuses as strings because that connector version does not support native enums; allowed values are validated in the API.
- The prototype is a modular monolith, not a production deployment.

## Acceptance Focus

The demo should support the end-to-end path: generate → review/edit/accept/reject → manage media → build and ready a package → take a quiz → inspect results → simulate distribution. It must also demonstrate payments without processing a payment. The use-case mapping and manual test plan are in [USE_CASE_TRACEABILITY.md](USE_CASE_TRACEABILITY.md) and [TEST_PLAN.md](TEST_PLAN.md).