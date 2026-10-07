# Case Resolution Desk

A full-stack tool that helps a SkillBridge coordinator review a learner case, reach a defensible recommendation, and track what happens next.

Rules are computed in deterministic Python. The LLM explains the outcome with cited policy. Cases are persisted to SQLite.

---

## Stack

- **Backend:** Python 3.9+, FastAPI, SQLAlchemy, SQLite
- **Retrieval:** TF-IDF (scikit-learn) over 5 seeded policy documents
- **LLM:** Groq (`openai/gpt-oss-20b`) — explain-only, never decides
- **Frontend:** React + Vite + Tailwind

---

## Setup

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env              # then edit .env and add GROQ_API_KEY
uvicorn app.main:app --reload
```

Backend: http://localhost:8000
Docs: http://localhost:8000/docs

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend: http://localhost:5173

---

## Environment Variables

Create `backend/.env` from `backend/.env.example`:

```
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=openai/gpt-oss-20b
DATABASE_URL=sqlite:///./cases.db
```

Get a free key at https://console.groq.com/keys.

---

## API Routes

- `POST /api/cases/analyze` — create + analyze a case
  - Request: `CaseFacts` JSON
  - Response: recommendation, status, rule outcome, LLM explanation, citations, missing facts, next action
- `GET /api/cases` — list all cases
- `GET /api/cases/{id}` — full case detail
- `POST /api/cases/{id}/notes` — add a case note
- `GET /health` — health + LLM status

Rejects impossible numbers (attendance > 100, score > 100) with HTTP 422.

---

## Retrieval Approach

- 5 policy documents (KB-01 to KB-05) seeded in `backend/app/policies/`.
- Each file is split into chunks by `##` section heading.
- Metadata preserved per chunk: `doc_id`, `version`, `effective_date`, `status`.
- TF-IDF index built at startup; queries embed the case question + key facts.
- Top-k chunks returned with metadata.
- **Version control:** KB-05 is labeled SUPERSEDED and never drives rule decisions for cases on/after 2026-10-01. It can only be cited in the explanation to clarify the version conflict.

---

## Rules Approach

All thresholds and approval checks live in `backend/app/rules_engine.py` as pure Python functions. The LLM is never consulted for decisions.

Deterministic rules:

| Rule | Threshold | Source |
|------|-----------|--------|
| Attendance | ≥ 80% | KB-01 v2 |
| Live sessions | ≥ 3 | KB-01 v2 |
| Capstone score | ≥ 70 | KB-02 v3 (never 60) |
| Submission must be safe | yes | KB-03 v2 |

Approval rules:

- Medical note offered ≠ verified ≠ waiver (KB-01).
- Extension requires request before deadline AND mentor approval (KB-02).
- Submission with a secret → on hold, overrides all other checks (KB-03).
- Unknown values (`None`) stay pending — never coerced to 0 or assumed sufficient.

Status assignment (KB-04):

1. Unsafe submission → `Waiting for Learner`
2. Pending mentor approval → `Waiting for Mentor`
3. Missing facts → `Waiting for Learner`
4. All clear → `Ready for Review`

---

## Tests

Two focused automated checks (plus two more):

```bash
cd backend
source venv/bin/activate
pytest tests/test_rules.py -v
pytest tests/test_api.py -v
```

- `test_rules.py` — threshold check + unknown-value check + submission hold
- `test_api.py` — Nadia's case returns pending/Waiting for Mentor; invalid attendance rejected with 422; Sara's case cites KB-05 as SUPERSEDED

All 6 tests pass.

---

## Manual Acceptance Results

### Case A — Nadia

- Recommendation: `pending`
- Status: `Waiting for Mentor`
- Blockers: attendance 76 < 80; sessions 2 < 3; medical note unverified; extension pending mentor approval
- Citations: KB-01 v2, KB-02 v3, KB-03 v2
- ✅ Matches expected behavior

### Case B — Hamza

- Recommendation: `on_hold`
- Status: `Waiting for Learner`
- Blockers: secret found in submission (KB-03 overrides good numbers)
- Citations: KB-01 v2, KB-02 v3, KB-03 v2
- ✅ Must not be declared eligible despite 82/3/78

### Case C — Sara

- Recommendation: `ineligible`
- Status: `Ready for Review`
- Blockers: capstone 65 < 70 (KB-02 v3)
- Citations: KB-01 v2, KB-02 v3, **KB-05 v1 (SUPERSEDED)**, KB-03 v2
- ✅ Correctly uses current 70 threshold, ignores old 60

### Case D — Missing Data

- Recommendation: `pending`
- Status: `Waiting for Learner`
- Missing facts: attendance_pct, live_sessions, capstone_score, submission_safe
- ✅ No fabricated values

---

## Failure Handling

If the LLM provider fails (timeout, 429, auth error):

- Rule outcome is still returned.
- Case is still saved.
- `llm_explanation` is null; `llm_error` is a readable message.
- No stack traces or API keys are exposed.

To demonstrate: temporarily set `GROQ_API_KEY=invalid` in `.env`, restart the backend, and analyze a case. The rule outcome renders; the UI shows an amber "LLM temporarily unavailable" banner.

---

## Assumptions

- One coordinator; no authentication or multi-user access.
- Case date defaults to 2026-10-07 unless specified.
- Unknown values remain unknown; they are never coerced or assumed.
- A request alone is not an approval (KB-02, KB-01).
- "Eligible" means the recorded requirements are met → Ready for Review. It does not mean a certificate has been issued (KB-01).
- KB-05 is never used to decide a current case.

---

## Human-Approval Decisions (Not Automated)

- Mentor approves makeup sessions (KB-01).
- Mentor approves capstone extensions (KB-02).
- Coordinator verifies medical evidence (KB-01).
- Coordinator confirms a clean submission after a secret hold (KB-03).
- Coordinator closes the case (KB-04).

---

## Limitations

### Scope and Deployment
- Local-only. No deployment, no hosting, no CI/CD.
- No authentication, no user accounts, no multi-user access. One coordinator per running instance.
- No rate limiting or request throttling on the API.
- Single-process FastAPI; not designed for concurrent heavy load.

### Data and Persistence
- SQLite only. Not suitable for multi-writer or production-scale use.
- SQLite database file (`cases.db`) is not versioned or backed up.
- No migration system (e.g., Alembic). Schema changes require deleting and recreating the DB.
- No soft deletes or audit history beyond the `case_notes` table.

### Retrieval
- TF-IDF only. No embeddings, no semantic search, no vector store.
- Retrieval quality depends on keyword overlap between the query and policy text.
- The retrieval index is rebuilt on every server restart (no persistent index).
- No re-ranking, no query expansion, no synonym handling.
- Top-k is fixed at 6 and not tunable at runtime.

### Rules Engine
- All thresholds (80%, 3 sessions, 70/100) are hardcoded in Python. Changing a policy requires a code change and redeploy.
- The case date is passed by the client and not cross-checked against any system clock or server-side source of truth.
- Business days are assumed Monday–Friday with no holidays, per the fictional assessment spec.
- No support for historical decisions (before 1 Oct 2026) beyond citing KB-05 as superseded.

### LLM Layer
- The LLM is treated as an explainer only. All decisions are made in code.
- If the LLM is unavailable, the app still works but the natural-language explanation is missing.
- LLM output is grounded only by the retrieved chunks in the prompt; there is no post-hoc grounding verification or citation validator.
- No prompt-injection protection. If retrieved policy text contained malicious instructions, the LLM could be influenced. The source pack is treated as trusted.
- Model IDs on Groq change over time. The `.env` value must be updated manually if the model is deprecated.
- Temperature is 0.2 for consistency, but LLM output is still non-deterministic across runs.

### Frontend
- No form-level validation for required fields beyond HTML `required`.
- No optimistic updates, offline mode, or retry logic for failed requests.
- No pagination, filtering, or search on the History list.
- No file upload for medical notes or submissions. All facts are typed manually.
- No case editing or re-analysis. A case can only be reopened for viewing.

### Testing
- 6 tests total. Coverage is focused on the two required checks (threshold and unknown-value) plus 4 extra.
- No integration test against a real Groq endpoint (mocked/absent).
- No load, stress, or concurrency tests.
- No frontend tests.

### Security
- API key stored in `.env` and never sent to the client, but there is no secrets manager.
- No HTTPS, no CSRF protection, no CORS hardening beyond localhost origins.
- No input sanitization beyond Pydantic validation.
- The Groq key was exposed in a development chat during the build and has been rotated.

### Out of Scope (Intentionally Not Built)
- Document upload flow (mentioned as optional in the brief).
- Editable draft responses.
- Audit trail beyond `case_notes`.
- Multi-approval workflows (makeup + extension queues).
- Notifications or reminders for pending approvals.
- Any paid service, hosting, or external database.

All policies, learner cases, and program details are fictional.