# Placement v2

## Account-specific manual setup (0018)

At the owner's explicit request on 22 November 2026, migration `0018` assigns N3 and waives initial placement for `kazutokaruai@gmail.com` only. It stores an audited nullable `users.placement_override`; it does not create an attempt, score, certificate or fabricated assessment history. Other accounts keep the mandatory gate. A later confirmed assessment deactivates the manual setup. Upgrade is repeat-safe; downgrade restores the preceding level when the override is still active and refuses to discard unrelated overrides.

Files for this change: `alembic/versions/0018_placement_override.py`, `app/models/database.py`, `app/services/placement_override.py`, `app/services/placement_profile.py`, `app/api/placement.py`, `tests/test_placement.py`, `tests/test_placement_override_migration.py`; frontend `services/placement.ts`, `components/Layout.tsx`, `components/placement/PlacementProfileSummary.tsx`, vi/en `placement.json`, `tests/placementGate.test.mjs`, and this document.

Validation: 37 placement/migration backend tests and 17 frontend gate/locale tests passed; frontend build and both web/mobile locale checks passed. Database readback confirms N3 and an active manual exemption. A live login was not checked because localhost:8000 was not running. Manual check: start the backend, sign in as the target account, confirm N3 and access without an exam; another unassessed account should still require placement. Profile must identify manual assignment rather than an estimated exam result.

Implemented on branch `mobile`; replaces the web `/placement` flow. Existing endpoint names and legacy attempt snapshots remain supported. The native app may reuse the authenticated JSON API; this change does not add a native exam screen.

## Run

From `backend` (Windows):

```powershell
.\venv\Scripts\python.exe -m alembic upgrade head
.\venv\Scripts\python.exe scripts/import_placement_questions.py
.\venv\Scripts\python.exe -m pytest tests/test_placement.py tests/test_placement_v2.py -q
```

From `frontend`: `npm.cmd run build`, `npm.cmd run i18n:check`, and `node --test tests/placementV2.test.mjs tests/placementGate.test.mjs tests/i18nTextIntegrity.test.mjs tests/authErrors.test.mjs`.

Migration `0015` follows `0014`, preserving old attempts as `legacy`. Repeated upgrade/downgrade are tested. Downgrade refuses populated v2 tables or v2 attempt history rather than deleting data; archive/export before a deliberate rollback. Startup does not create placement tables implicitly. Local migration was applied after saving the pre-existing attempt in an ignored backup.

## Content and limits

The explicitly invoked importer publishes an **N5 demonstration**: 10 original vocabulary questions, 10 kanji readings, 10 grammar questions, 10 reading questions across three passages, and up to 10 listening questions using existing published N5 seed clips. Audio must exist under the configured media directory with valid segment bounds. No official questions or audio are copied. With existing audio available, N5 is playable; N4–N1 stay unavailable until all five skills have enough published questions. Demonstration results never set `current_jlpt_level`; users may save them as a reference and leave initial setup while remaining visibly unassessed.

Questions carry source/version, publication status, difficulty, private answer/explanation, demo flag and optional shared stimulus. Content changes produce new versions. Attempts retain immutable question/choice snapshots; later imports do not rewrite previous answers. Real reviewed content must be explicitly marked published and non-demo by its review/import process. There is no claim of linguistic calibration or statistical validation from these fixtures. Unpublished content never enters an exam.

## Policy

Configuration lives in `app/core/placement_config.py`, with separate selection, session, scoring and profile services. Scores are internal raw percentages, balanced equally over vocabulary, kanji, grammar, reading and listening, and have version identifiers. They are not official JLPT scaled scores, IRT or a calibrated probability of passing.

- Adaptive begins at N5 and uses only a contiguous sequence of sufficiently stocked levels. Three consecutive correct answers at the current level move up one level; two incorrect move down. A single answer cannot change level. Previously committed adaptive answers are immutable.
- At least 20 and at most 30 answers; an estimate requires at least three answered questions in **each skill at the estimated level**, mean at least 70% and every skill at least 60%. Otherwise evidence is insufficient. Stop after enough evidence or at the cap. Repeated attempts prefer unseen sources; no repeated source within an attempt.
- Confirmation uses 30 questions, six per skill, all at the selected level. All 30 must be answered to establish an estimate. Internal suitability threshold is mean 60%, each skill 50%; strong performance means mean 85%, each skill 70%. Strong/low results suggest an adjacent assessment without awarding that adjacent level. Availability is checked when starting it.
- Server deadline is 30 minutes. Late requests finalize without accepting a late answer. UTC timestamps are explicit even with SQLite. Missing answers score zero. Expired/incomplete evidence cannot establish a level.
- Client sends only choice IDs and item revisions. Server grades, locks session rows, applies revision compare-and-swap, and returns no answer key, correctness, explanation, transcript or filesystem path during the exam. Duplicate answer/submit/confirm requests are idempotent. Every read, write and media request checks ownership. PostgreSQL row locks serialize session mutations; item revisions also reject stale writes.
- Profile changes only on explicit confirmation of the latest completed result. Saving demo/insufficient evidence preserves the stored learning fallback. Existing legacy results remain identified as legacy estimates. Progress reset preserves placement; account deletion removes owned attempts/items; export includes profile assessment history.

## API

All paths below use the existing `/api/placement` prefix, JWT authentication and error translation conventions:

| Method/path | Purpose |
| --- | --- |
| `GET /levels?language=vi` | Skill counts, available levels, demo status, time limit |
| `POST /attempts` | `{language, mode: adaptive|confirmation, selected_level?}`; omitting mode preserves legacy clients |
| `GET /attempts`, `GET /attempts/{id}` | Owned history/resume, stable choices, revisions, deadline/server time |
| `POST /attempts/{id}/answers` | `{question_key, answer: choiceId, revision}`; fixed drafts editable before submission |
| `POST /attempts/{id}/submit` | Idempotent final score; no client score accepted |
| `GET /attempts/{id}/result` | Completed result only |
| `POST /attempts/{id}/confirm` | Explicit profile save, latest result only |
| `POST /attempts/{id}/abandon` | Retain attempt/answers while starting another mode |
| `GET /attempts/{id}/media/{item_id}` | Owned private audio; bounds in the question |
| `GET /profile/summary`, `GET /status` | Accepted estimate/source, skills, history and initial setup state |

`recommended_level=N5` remains a legacy-compatible study fallback when `estimated_level=null`; consumers must use `estimated_level`, `is_demo` and `evidence_status` to describe assessment conclusions. The mobile API should never interpret that fallback as a verified level.

The web page offers mode selection first, explicit resume/replacement of existing attempts, native radio choices, previous/next, draft save on navigation, missing-answer confirmation, retry, deadline, result bars and reference/estimate saving. Reload resumes committed choices; an unsent local radio selection triggers the browser leave warning. Profile shows assessment history and compares scores only from the same confirmation level/scoring version, excluding demo and adaptive scores. Existing Chat, Grammar and Daily paths already read `current_jlpt_level`; Kanji and Listening now prefer that level while respecting explicit practice filters and supported dictionary levels. Weak skills feed the initial roadmap; no standalone reading module is added.

## References consulted

- [Official sample formats](https://www.jlpt.jp/e/samples/forlearners.html)
- [Official workbook and audio structure](https://www.jlpt.jp/e/samples/sampleindex.html)
- [Official sections and timing](https://www.jlpt.jp/e/guideline/testsections.html)
- [Official scaled scores and pass criteria](https://www.jlpt.jp/e/guideline/results.html)
- [TTBJ teacher guidance](https://ttbj.cegloc.tsukuba.ac.jp/doc/teacher/doc_en.pdf)
- [Marugoto level check](https://www.marugoto-online.jp/info/level_check_test/?lang=eng): no readable page content was returned; no algorithm claim is attributed to it.

## Manual acceptance checklist

Validation on this working tree:

- Frontend production build: passed (existing chunk-size/Browserslist warnings).
- Placement backend: **35 passed**, including 16 v2 cases and 19 legacy/compatibility cases; N5–N1 use isolated reviewed fixtures.
- Full pytest: **245 passed, 8 failed**, six subtests passed. The eight pre-existing Chat failures remain in `test_chat_conversations.py` (one), `test_chat_grounding.py` (four), and `test_chat_language.py` (three). Their baseline reproduction preceded this replacement; no Chat implementation was changed here.
- Frontend placement/gate/i18n/login regression tests: **21 passed**.
- Frontend/mobile i18n, mobile TypeScript: passed. Mobile regression suite: **138 passed**.
- Demo import repeated: **0 new rows** on the second identical import; updated content uses new versions.
- Browser component verification: four viewport/language/theme combinations passed with reduced motion emulated. Screenshots are in ignored `tmp/placement-*.png`.
- Full authenticated workflow and actual listening playback still require the manual checks below; they were not claimed as end-to-end browser coverage.

Files created/changed for the two-mode replacement (earlier login, kanji model and mandatory-setup changes are preserved separately):

```text
backend/alembic/versions/0015_placement_v2.py
backend/app/models/database.py
backend/app/main.py
backend/app/api/placement.py
backend/app/api/auth.py
backend/app/core/placement_config.py
backend/app/data/placement_demo_n5.json
backend/app/services/placement_question_bank.py
backend/app/services/placement_selection.py
backend/app/services/placement_scoring.py
backend/app/services/placement_assessment_service.py
backend/app/services/placement_profile.py
backend/scripts/import_placement_questions.py
backend/tests/test_placement.py
backend/tests/test_placement_v2.py
backend/PLACEMENT.md
frontend/src/pages/Placement.tsx
frontend/src/pages/Profile.tsx
frontend/src/pages/Kanji.jsx
frontend/src/pages/ListeningLessons.tsx
frontend/src/components/Layout.tsx
frontend/src/components/kanji/KanjiStudy.jsx
frontend/src/components/placement/PlacementSetup.tsx
frontend/src/components/placement/PlacementResults.tsx
frontend/src/components/placement/PlacementProfileSummary.tsx
frontend/src/components/placement/LegacyPlacementQuestion.tsx
frontend/src/services/placement.ts
frontend/src/utils/placementDefaults.ts
frontend/src/i18n/locales/vi/placement.json
frontend/src/i18n/locales/en/placement.json
frontend/src/i18n/locales/vi/errors.json
frontend/src/i18n/locales/en/errors.json
frontend/tests/placementV2.test.mjs
```

- [ ] Log in before the first assessment: mode selection appears at `/placement`; no free profile level picker.
- [ ] Switch both modes, verify N5 demo warning and disabled N4–N1 with current content.
- [ ] Resume the old attempt or explicitly replace it; refresh after sending choices and confirm progress persists.
- [ ] Fixed exam: edit an earlier choice, navigate back/next, submit with missing answers and cancel once.
- [ ] Adaptive exam: verify committed answers cannot change and no correctness is shown.
- [ ] Read shared passages; play listening clips; test unavailable audio and retry after reconnecting.
- [ ] Expire a session, retry submission, double-click submit/save, and verify one immutable result.
- [ ] Save demo reference: header stays unassessed, existing learning level remains intact, app becomes accessible.
- [ ] With reviewed non-demo fixture data, confirm the latest result and verify Profile, Chat, Grammar, Kanji and Listening use it; explicit practice filters still work.
- [ ] Check Vietnamese/English, keyboard focus, 320px/mobile/tablet/desktop, light/dark and reduced motion in the full authenticated shell.

Automated browser checks used the actual setup component, existing CSS/i18n and controlled availability data at 1280/768/390/320px (light/dark, vi/en, reduced motion): no overflow, missing mode controls or incorrect disabled levels. This is component UI verification; the checklist above covers the full authenticated workflow and real playback.
