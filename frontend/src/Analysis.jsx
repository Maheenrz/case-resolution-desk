import { useState } from 'react';
import Markdown, { Inline } from './Markdown';
import { addNote } from './api';

const NEUTRAL = 'bg-paper-200 text-ink-700 ring-paper-300';

const REC = {
  eligible: { label: 'Eligible', chip: 'bg-emerald-50 text-emerald-800 ring-emerald-200', dot: 'bg-emerald-500', tone: 'text-emerald-600' },
  ineligible: { label: 'Not eligible', chip: 'bg-rose-50 text-rose-800 ring-rose-200', dot: 'bg-rose-500', tone: 'text-rose-600' },
  on_hold: { label: 'On hold', chip: 'bg-orange-50 text-orange-800 ring-orange-200', dot: 'bg-orange-500', tone: 'text-orange-600' },
  pending: { label: 'Pending', chip: 'bg-amber-50 text-amber-800 ring-amber-200', dot: 'bg-amber-500', tone: 'text-amber-600' },
};

const STATUS = {
  'Waiting for Learner': 'bg-blue-50 text-blue-800 ring-blue-200',
  'Waiting for Mentor': 'bg-purple-50 text-purple-800 ring-purple-200',
  'Ready for Review': 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  Open: NEUTRAL,
  Closed: 'bg-paper-300 text-ink-500 ring-paper-400',
};

const CHECK = {
  pass: { label: 'Pass', icon: 'bg-emerald-50 text-emerald-700', chip: 'bg-emerald-50 text-emerald-800 ring-emerald-200', path: 'M5 13l4 4L19 7' },
  fail: { label: 'Fail', icon: 'bg-rose-50 text-rose-700', chip: 'bg-rose-50 text-rose-800 ring-rose-200', path: 'M6 18L18 6M6 6l12 12' },
  unknown: { label: 'Unknown', icon: 'bg-paper-200 text-ink-500', chip: NEUTRAL, path: 'M9 9a3 3 0 115 2c-1 1-2 1.5-2 3M12 18h.01' },
};

export default function Analysis({ data, onBack }) {
  const rec = data.recommendation || data.rule_outcome?.recommendation || 'pending';
  const status = data.status || 'Open';
  const outcome = data.rule_outcome || data;
  const r = REC[rec] || { label: String(rec).replace(/_/g, ' '), chip: NEUTRAL, dot: 'bg-ink-400', tone: 'text-ink-900' };
  const next = data.next_action || outcome?.next_action;
  const caseId = data.case_id || data.id;

  const checks = [
    ['Attendance', outcome?.attendance_check],
    ['Live sessions', outcome?.session_check],
    ['Capstone', outcome?.capstone_check],
    ['Submission', outcome?.submission_check],
    ['Extension', outcome?.extension_check],
  ].filter(([, c]) => c);
  const passedCount = checks.filter(([, c]) => c.passed === true).length;

  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-ink-500 transition hover:text-ink-900"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to form
      </button>

      {/* Verdict */}
      <section className="card p-7 sm:p-9">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            {caseId && <p className="text-sm font-medium text-ember-500">Case #{caseId}</p>}
            <h2 className="mt-1 font-display text-4xl font-semibold tracking-tight text-ink-900 sm:text-5xl">
              {data.learner_name || `Case #${caseId}`}
            </h2>
            {data.question && (
              <p className="mt-3 max-w-2xl text-[15px] leading-7 text-ink-500">“{data.question}”</p>
            )}
          </div>
          <Chip cls={STATUS[status] || NEUTRAL}>{status}</Chip>
        </div>

        <div className="mt-8 grid gap-px overflow-hidden rounded-xl border border-paper-300 bg-paper-300 sm:grid-cols-3">
          <Stat label="Recommendation" value={r.label} tone={r.tone} />
          <Stat label="Rule checks passed" value={checks.length ? `${passedCount} of ${checks.length}` : 'None run'} />
          <Stat label="Blockers" value={outcome?.blockers?.length ?? 0} />
        </div>
      </section>

      {/* Next action */}
      {next && (
        <div className="rounded-2xl border border-ember-300 bg-ember-50 p-6">
          <h3 className="font-display text-lg font-medium text-ink-900">Next action</h3>
          <div className="mt-2">
            <Markdown text={next} />
          </div>
        </div>
      )}

      {/* LLM error */}
      {data.llm_error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-semibold text-amber-900">LLM temporarily unavailable</p>
          <p className="mt-1 text-sm text-amber-800">{data.llm_error}</p>
          <p className="mt-2 text-xs text-amber-800">
            The rule outcome below is still valid and the case has been saved.
          </p>
        </div>
      )}

      {/* Explanation */}
      {data.llm_explanation && (
        <Card title="Explanation">
          <Markdown text={data.llm_explanation} className="max-w-prose" />
        </Card>
      )}

      {/* Rule checks */}
      {checks.length > 0 && (
        <Card title="Rule checks" aside={`${passedCount} of ${checks.length} passed`}>
          <ul className="divide-y divide-paper-300">
            {checks.map(([label, check]) => (
              <CheckRow key={label} label={label} check={check} />
            ))}
          </ul>
        </Card>
      )}

      {/* Blockers */}
      {outcome?.blockers?.length > 0 && (
        <Card title="Blockers">
          <ul className="space-y-2">
            {outcome.blockers.map((b, i) => (
              <li key={i} className="flex gap-3 text-[15px] leading-7 text-ink-700">
                <span aria-hidden className="mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
                <span><Inline text={b} /></span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Missing facts */}
      {data.missing_facts?.length > 0 && (
        <Card title="Missing facts">
          <div className="flex flex-wrap gap-2">
            {data.missing_facts.map((m, i) => (
              <span key={i} className="rounded-md border border-ember-300 bg-ember-50 px-2.5 py-1 text-xs font-medium text-ember-700">
                {m}
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Citations */}
      {data.citations?.length > 0 && (
        <Card title="Sources">
          <ul className="divide-y divide-paper-300">
            {data.citations.map((c, i) => (
              <li key={i} className="flex flex-wrap items-center gap-3 py-3 text-sm first:pt-0 last:pb-0">
                <span className="font-mono font-medium text-ink-900">{c.doc_id} {c.version}</span>
                <Chip cls={c.status === 'CURRENT' ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : NEUTRAL}>
                  {c.status}
                </Chip>
                <span className="text-ink-500">{c.section}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Notes */}
      {caseId && <Notes caseId={caseId} initialNotes={data.notes || []} />}
    </div>
  );
}

function Notes({ caseId, initialNotes }) {
  const [notes, setNotes] = useState(initialNotes);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await addNote(caseId, text.trim());
      setNotes((n) => [...n, res.data]);
      setText('');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save note');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="Case notes" aside={`${notes.length} ${notes.length === 1 ? 'note' : 'notes'}`}>
      {notes.length > 0 ? (
        <ul className="mb-5 space-y-3">
          {notes.map((n) => (
            <li key={n.id} className="rounded-lg border border-paper-300 bg-paper-100 p-3">
              <p className="text-[15px] leading-7 text-ink-800">{n.note}</p>
              <p className="mt-1 text-xs text-ink-500">
                {new Date(n.created_at).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-5 text-sm text-ink-500">No notes yet.</p>
      )}

      <form onSubmit={submit} className="space-y-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder="Add a note about this case (e.g., called learner, mentor replied)..."
          className="input"
        />
        {error && (
          <p className="text-sm text-rose-600">{error}</p>
        )}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving || !text.trim()}
            className="rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-ink-800 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Add note'}
          </button>
        </div>
      </form>
    </Card>
  );
}

function Chip({ cls, children }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${cls}`}>
      {children}
    </span>
  );
}

function Card({ title, aside, children }) {
  return (
    <section className="card p-6">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h3 className="font-display text-lg font-medium text-ink-900">{title}</h3>
        {aside && <span className="text-sm text-ink-500">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

function CheckRow({ label, check }) {
  const passed = check.passed;
  const m = CHECK[passed === true ? 'pass' : passed === false ? 'fail' : 'unknown'];
  const hasActual = check.actual !== null && check.actual !== undefined;
  const hasRequired = check.required !== null && check.required !== undefined;

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 py-4 first:pt-0 last:pb-0">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${m.icon}`}>
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d={m.path} />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium text-ink-900">{label}</p>
        <p className="text-sm text-ink-500">
          {hasActual ? `Actual ${check.actual}` : 'Actual not recorded'}
          {hasRequired ? `, required ${check.required}` : ''}
        </p>
        {check.source && <p className="font-mono text-xs text-ink-500">{check.source}</p>}
      </div>
      <Chip cls={m.chip}>{m.label}</Chip>
    </li>
  );
}

function Stat({ label, value, tone = 'text-ink-900' }) {
  return (
    <div className="bg-white p-5">
      <p className={`font-display text-3xl font-semibold tracking-tight ${tone}`}>{value}</p>
      <p className="mt-1 text-xs text-ink-500">{label}</p>
    </div>
  );
}