# Migration and Change Management Plan

This is a conceptual plan for a future migration. No production migration has been performed.

1. Inventory existing question banks, spreadsheets, and media repositories; record owners, formats, counts, and backup locations.
2. Map legacy columns into `Question`, `AnswerOption`, `EducationLevel`, `Subject`, `Topic`, and `QuestionMedia`.
3. Normalize inconsistent labels and option formats; detect duplicate questions and missing answer explanations.
4. Preserve a read-only backup of each source before transformation.
5. Import a representative batch into a separate test database and record imported, skipped, and failed row counts.
6. Ask instructors to review a sample of imported questions, answer keys, explanations, taxonomy, and rejection cases.
7. Validate question-to-media links and capture source/license notes; do not assume external media is reusable without evidence.
8. Run a limited instructor pilot, collect corrections, and update mapping rules before any broader migration.
9. Provide a short operator guide and migration support contact for the pilot.
10. If the pilot fails, stop imports and return users to the backed-up spreadsheet or previous repository while preserving import logs for diagnosis.

The prototype seed/reset command only manages local demonstration data. It is not a production migration tool.