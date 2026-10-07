import { useState } from 'react';
import { analyzeCase } from './api';

const initial = {
  learner_name: '',
  question: '',
  attendance_pct: '',
  live_sessions: '',
  capstone_score: '',
  medical_note_offered: false,
  medical_note_verified: false,
  submission_safe: 'unknown',
  extension_requested: false,
  extension_request_time: '',
  extension_approved: false,
};

export default function CaseForm({ onResult, onError }) {
  const [form, setForm] = useState(initial);
  const [loading, setLoading] = useState(false);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
      learner_name: form.learner_name,
      question: form.question,
      attendance_pct: form.attendance_pct === '' ? null : Number(form.attendance_pct),
      live_sessions: form.live_sessions === '' ? null : Number(form.live_sessions),
      capstone_score: form.capstone_score === '' ? null : Number(form.capstone_score),
      medical_note_offered: form.medical_note_offered,
      medical_note_verified: form.medical_note_verified,
      submission_safe:
        form.submission_safe === 'unknown' ? null : form.submission_safe === 'yes',
      extension_requested: form.extension_requested,
      extension_request_time: form.extension_request_time || null,
      extension_approved: form.extension_approved,
    };

    try {
      const res = await analyzeCase(payload);
      onResult(res.data);
    } catch (err) {
      onError?.(err.response?.data?.detail?.[0]?.msg || err.response?.data?.detail || 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  const loadNadia = () => setForm({
    ...initial,
    learner_name: 'Nadia',
    question: 'Can I still receive a certificate? Can I submit my capstone one day late?',
    attendance_pct: '76',
    live_sessions: '2',
    medical_note_offered: true,
    extension_requested: true,
    extension_request_time: '2026-10-07T11:00',
  });
  const loadSara = () => setForm({
    ...initial,
    learner_name: 'Sara',
    question: 'A colleague said 60 is enough to pass. Am I eligible?',
    attendance_pct: '85',
    live_sessions: '3',
    capstone_score: '65',
    submission_safe: 'yes',
  });
  const loadHamza = () => setForm({
    ...initial,
    learner_name: 'Hamza',
    question: 'Can I get my certificate?',
    attendance_pct: '82',
    live_sessions: '3',
    capstone_score: '78',
    submission_safe: 'no',
  });
  const loadMissing = () => setForm({
    ...initial,
    learner_name: 'Unknown Learner',
    question: 'Am I eligible?',
  });

  const recorded =
    [form.attendance_pct, form.live_sessions, form.capstone_score].filter((v) => v !== '').length +
    (form.submission_safe !== 'unknown' ? 1 : 0);

  return (
    <div className="space-y-8">
      <div className="space-y-6 pt-4 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-paper-300 bg-white px-3.5 py-1.5 text-xs font-medium text-ink-700 shadow-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-ember-500" />
          SkillBridge eligibility check
        </span>
        <h2 className="font-display text-4xl font-semibold tracking-tight text-ink-900 sm:text-5xl">
          Resolve every learner case
          <br />
          <span className="text-ember-500">with the facts on record</span>
        </h2>
        <p className="mx-auto max-w-xl text-[15px] leading-7 text-ink-500">
          Enter what is on record. Anything you leave blank is flagged as missing, never assumed.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="text-sm text-ink-500">Quick load</span>
          <Pill onClick={loadNadia}>Nadia</Pill>
          <Pill onClick={loadSara}>Sara</Pill>
          <Pill onClick={loadHamza}>Hamza</Pill>
          <Pill onClick={loadMissing}>Missing</Pill>
        </div>
      </div>

      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
        <div className="space-y-5">
          <Section title="Learner basics" subtitle="Who is asking and what they want to know">
            <div className="space-y-4">
              <Field label="Learner name">
                <input
                  type="text"
                  value={form.learner_name}
                  onChange={(e) => update('learner_name', e.target.value)}
                  required
                  placeholder="e.g., Nadia"
                  className="input"
                />
              </Field>
              <Field label="Question">
                <textarea
                  value={form.question}
                  onChange={(e) => update('question', e.target.value)}
                  required
                  rows={3}
                  placeholder="What is the learner asking?"
                  className="input"
                />
              </Field>
            </div>
          </Section>

          <Section title="Recorded facts" subtitle="Leave blank if the value is unknown">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field label="Attendance %" hint="blank = unknown">
                <input type="number" value={form.attendance_pct}
                  onChange={(e) => update('attendance_pct', e.target.value)}
                  min="0" max="100" placeholder="—" className="input" />
              </Field>
              <Field label="Live sessions" hint="blank = unknown">
                <input type="number" value={form.live_sessions}
                  onChange={(e) => update('live_sessions', e.target.value)}
                  min="0" placeholder="—" className="input" />
              </Field>
              <Field label="Capstone score" hint="blank = unknown">
                <input type="number" value={form.capstone_score}
                  onChange={(e) => update('capstone_score', e.target.value)}
                  min="0" max="100" placeholder="—" className="input" />
              </Field>
            </div>
          </Section>

          <Section title="Medical evidence" subtitle="A note alone does not waive requirements">
            <div className="flex flex-wrap gap-6">
              <Checkbox checked={form.medical_note_offered}
                onChange={(v) => update('medical_note_offered', v)}
                label="Note offered by learner" />
              <Checkbox checked={form.medical_note_verified}
                onChange={(v) => update('medical_note_verified', v)}
                label="Verified by coordinator" />
            </div>
          </Section>

          <Section title="Submission safety" subtitle="KB-03 overrides all other checks">
            <Field label="Secret scan result">
              <select value={form.submission_safe}
                onChange={(e) => update('submission_safe', e.target.value)}
                className="input">
                <option value="unknown">Unknown, not yet checked</option>
                <option value="yes">Safe, no secrets found</option>
                <option value="no">Unsafe, secret found in package</option>
              </select>
            </Field>
          </Section>

          <Section title="Extension request" subtitle="Only valid if requested before the deadline and approved">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-6">
                <Checkbox checked={form.extension_requested}
                  onChange={(v) => update('extension_requested', v)}
                  label="Requested by learner" />
                <Checkbox checked={form.extension_approved}
                  onChange={(v) => update('extension_approved', v)}
                  label="Approved by mentor" />
              </div>
              {form.extension_requested && (
                <Field label="Request timestamp">
                  <input type="datetime-local" value={form.extension_request_time}
                    onChange={(e) => update('extension_request_time', e.target.value)}
                    className="input" />
                </Field>
              )}
            </div>
          </Section>
        </div>

        <aside className="card space-y-4 p-6 lg:sticky lg:top-28">
          <div>
            <p className="font-display text-lg font-medium text-ink-900">{recorded} of 4 key facts recorded</p>
            <p className="mt-1 text-sm leading-6 text-ink-500">
              Attendance, live sessions, capstone score and the secret scan. Blank facts are reported as missing, not assumed.
            </p>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-ink-900 px-4 py-3 font-medium text-paper-50 shadow-card transition hover:bg-ink-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (<><Spinner />Analyzing…</>) : 'Analyze case'}
          </button>
        </aside>
      </form>
    </div>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <div className="card p-6">
      <div className="mb-5">
        <h3 className="font-display text-lg font-medium text-ink-900">{title}</h3>
        {subtitle && <p className="mt-0.5 text-sm text-ink-500">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink-700">
        {label}
        {hint && <span className="ml-2 text-xs font-normal text-ink-500">({hint})</span>}
      </span>
      {children}
    </label>
  );
}

function Checkbox({ checked, onChange, label }) {
  return (
    <label className="flex cursor-pointer select-none items-center gap-2">
      <input type="checkbox" checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-paper-400 accent-ink-900" />
      <span className="text-sm text-ink-700">{label}</span>
    </label>
  );
}

function Pill({ onClick, children }) {
  return (
    <button type="button" onClick={onClick}
      className="rounded-full border border-paper-400 bg-white px-3.5 py-1.5 text-xs font-medium text-ink-700 transition hover:border-ember-500 hover:bg-ember-50">
      {children}
    </button>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}