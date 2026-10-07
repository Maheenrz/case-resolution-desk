# Case Resolution Desk — Technical Documentation

SkillBridge helpdesk tool. A coordinator enters a learner's facts, gets a
rule-based recommendation with cited policy, and the case is saved.

---

## 1. Overview

Full-stack web app for SkillBridge helpdesk coordinators. The coordinator
submits a learner's facts, the backend evaluates them against five policy
documents in code, the LLM explains the result with citations, and the case
is persisted to SQLite.

Key separation:

- Rules are in Python code. Deterministic.
- The LLM only explains. It cannot decide.
- Cases persist locally.

The tool never issues approvals or certificates. Those are human decisions.

---

## 2. Architecture

```text
Frontend (React + Vite + Tailwind)
        │  HTTP/JSON
        ▼
FastAPI Backend
 ├── Pydantic validation
 ├── rules_engine.py     → decides eligibility
 ├── retrieval.py        → TF-IDF over policy chunks
 ├── llm_explainer.py    → Groq, explains only
 ├── database.py         → SQLite
 └── main.py             → pipeline orchestrator
        │
        ▼
Policy corpus (KB-01 … KB-05, Markdown)
```

Pipeline: validate → evaluate rules → retrieve chunks → explain → persist.

Thresholds (80%, 3 sessions, 70/100) are hardcoded. Policy files are read
only by retrieval, to give the LLM text to cite.

---

## 3. Data Model

**CaseFacts** (input): `learner_name`, `question`, `attendance_pct`,
`live_sessions`, `capstone_score`, `medical_note_offered`,
`medical_note_verified`, `submission_safe`, `extension_requested`,
`extension_request_time`, `extension_approved`, `makeup_requested`,
`makeup_approved`, `case_date`.

Unknown values use `None` and stay unknown.

**RuleOutcome** (output): `recommendation` (eligible / ineligible / pending /
on_hold), `status` (Open / Waiting for Learner / Waiting for Mentor / Ready
for Review / Closed), per-check results, `blockers`, `missing_facts`,
`next_action`, `citations`.

**CheckResult**: `passed` (True / False / None), `actual`, `required`, `source`.

**SQLite tables**: `cases`, `case_notes`, `citations`.

---

## 4. Policy Corpus

| ID | Title | Version | Status |
|----|-------|---------|--------|
| KB-01 | Attendance and certification | v2 | CURRENT |
| KB-02 | Capstone policy | v3 | CURRENT |
| KB-03 | Submission and security | v2 | CURRENT |
| KB-04 | Helpdesk workflow | v1 | CURRENT |
| KB-05 | Old capstone policy | v1 | SUPERSEDED by KB-02 |

KB-05 is never used to decide a current case. It is cited only as
SUPERSEDED when a question involves the old 60-point rule.

---

## 5. Rules Engine

All thresholds and approvals live in `rules_engine.py` as pure Python.

| Rule | Threshold | Source |
|------|-----------|--------|
| Attendance | ≥ 80% | KB-01 v2 |
| Live sessions | ≥ 3 | KB-01 v2 |
| Capstone | ≥ 70/100 | KB-02 v3 |
| Submission safe | yes | KB-03 v2 |

Approval logic:

- Medical note offered ≠ verified ≠ waiver.
- Extension requires request before deadline AND mentor approval.
- Submission hold (KB-03) overrides all other checks.
- Unknown values stay pending.

Recommendation:

1. Unsafe submission → `on_hold`
2. Missing facts → `pending`
3. Threshold failure with a cure path → `pending`
4. Threshold failure without a cure path → `ineligible`
5. Pending mentor approval → `pending`
6. All clear → `eligible`

Status (KB-04 order):

1. Unsafe submission → `Waiting for Learner`
2. Pending mentor approval → `Waiting for Mentor`
3. Missing facts → `Waiting for Learner`
4. All clear → `Ready for Review`

---

## 6. Retrieval

TF-IDF (scikit-learn) over policy chunks.

- Each policy file is split by `##` heading.
- Each chunk carries `doc_id`, `version`, `effective_date`, `status`, `section`, `text`.
- Index built once at startup.
- Query = case question + key facts.
- Top 6 chunks returned with metadata.
- KB-05 chunks are relabeled SUPERSEDED at retrieval time.
- Retrieval never influences rule decisions.

---

## 7. LLM Layer

- Provider: Groq
- Model: `openai/gpt-oss-20b` (configurable)
- Temperature 0.2, max 500 tokens
- System prompt: explain only, cite sources, do not decide.
- User prompt includes: facts, computed outcome, retrieved chunks, task.
- Grounding: the LLM sees only the retrieved chunks and the outcome.
- Failure: returns `(None, error)`; rule outcome still returned; case still saved.

---

## 8. API

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/cases/analyze` | Create + analyze a case |
| GET | `/api/cases` | List all cases |
| GET | `/api/cases/{id}` | Full case detail |
| POST | `/api/cases/{id}/notes` | Add a note |
| GET | `/health` | Health + LLM status |

**POST `/api/cases/analyze`** request:

```json
{
  "learner_name": "Nadia",
  "question": "Can I still receive a certificate?",
  "attendance_pct": 76,
  "live_sessions": 2,
  "capstone_score": null,
  "medical_note_offered": true,
  "medical_note_verified": false,
  "submission_safe": null,
  "extension_requested": true,
  "extension_request_time": "2026-10-07T11:00:00",
  "extension_approved": false
}
```

Response includes: `case_id`, `recommendation`, `status`, `rule_outcome`
(with per-check results, blockers, missing_facts, citations),
`llm_explanation`, `llm_error`, `missing_facts`, `next_action`.

Errors: `422` on impossible numbers (attendance > 100). `404` on missing case.

---

## 9. Frontend

React 18 + Vite + Tailwind.

- **New Case:** form plus quick-load buttons for Nadia, Sara, Hamza, Missing.
- **Analysis:** recommendation badge, status badge, LLM explanation,
  rule checks, blockers, missing facts, citations with CURRENT / SUPERSEDED
  badges, next-action callout.
- **History:** table of all cases, click to reopen.

LLM failure is shown as an amber banner; the rule outcome stays visible.

---

## 10. Persistence

SQLite file `backend/cases.db`. Three tables: `cases`, `case_notes`, `citations`.

Cases survive backend restarts. No migrations; schema changes require
deleting the file.

---

## 11. Failure Handling

| Failure | Behavior |
|---------|----------|
| Groq timeout / 429 / bad key | `llm_error` set, rule outcome returned, case saved |
| Invalid input | HTTP 422 |
| Missing `GROQ_API_KEY` | LLM calls return "not configured"; rule outcome unaffected |
| Empty retrieval | LLM sees fewer chunks; outcome unaffected |
| DB deleted | Fresh DB created on next start |

No stack traces or API keys are exposed to the client.

---

## 12. Acceptance Cases

| Case | Recommendation | Status | Key citations |
|------|----------------|--------|---------------|
| Nadia | `pending` | Waiting for Mentor | KB-01 v2, KB-02 v3 |
| Hamza | `on_hold` | Waiting for Learner | KB-03 v2 |
| Sara | `ineligible` | Ready for Review | KB-02 v3, KB-05 SUPERSEDED |
| Missing | `pending` | Waiting for Learner | KB-01 v2, KB-04 v1 |

---

## 13. Testing

Six pytest tests, all passing.

Required by the brief:

- Threshold check: attendance 76 → `ineligible`.
- Approval / unknown-value check: attendance `None` → `pending`.

Extra:

- Submission hold overrides good numbers.
- Nadia's full pipeline via HTTP.
- Impossible attendance rejected with 422.
- Sara cites KB-05 as SUPERSEDED.

Run:

```bash
cd backend
source venv/bin/activate
pytest tests/test_rules.py -v
pytest tests/test_api.py -v
```

---

## 14. Assumptions

- One coordinator, no auth.
- Case date defaults to 2026-10-07.
- Unknown values stay unknown.
- A request is not an approval.
- "Eligible" means requirements met → Ready for Review, not certified.
- KB-05 never decides a current case.

Human-approval decisions (not automated):

- Mentor approves makeups and extensions.
- Coordinator verifies medical evidence and clean submissions.
- Coordinator closes cases.

---

## 15. Limitations

- Local only: no deployment, no auth, no multi-user.
- SQLite only; no migrations; not backed up.
- TF-IDF retrieval only; no embeddings, no semantic search.
- Thresholds hardcoded; policy changes need a code change.
- No prompt-injection protection; the source pack is treated as trusted.
- LLM output is non-deterministic; no post-hoc citation validator.
- No file upload; all facts are typed manually.
- No case editing or re-analysis.
- Six tests total; no frontend tests, no load tests.
- Secrets in `.env` only; no external secrets manager.

Out of scope:

- Document upload flow.
- Editable draft responses.
- Audit trail UI.
- Multi-approval workflows.
- Notifications.

---

## 16. Setup

**Backend:**

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env      # add GROQ_API_KEY
uvicorn app.main:app --reload
```

**Frontend:**

```bash
cd frontend
npm install
npm run dev
```

**Environment** (`backend/.env`):

```text
GROQ_API_KEY=your_key_here
GROQ_MODEL=openai/gpt-oss-20b
DATABASE_URL=sqlite:///./cases.db
```

---

## 17. Future Work

- Embeddings for retrieval.
- Document upload with version review.
- Case editing and re-analysis.
- Audit trail UI.
- Notifications for pending approvals.
- Multi-user with auth.
- Persistent retrieval index.
- Citation validator on LLM output.
- Historical replay before 1 Oct 2026.

---

All policies, learner cases, and program details are fictional.