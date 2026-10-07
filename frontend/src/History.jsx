import { useEffect, useState } from 'react';
import { listCases, API_URL } from './api';

const NEUTRAL = 'bg-paper-200 text-ink-700 ring-paper-300';

export default function History({ onSelect, onNew }) {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    listCases()
      .then((r) => setCases(r.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-3xl font-semibold tracking-tight text-ink-900">Case history</h2>
        <p className="mt-1 text-sm text-ink-500">
          {cases.length} case{cases.length !== 1 ? 's' : ''} on record
        </p>
      </div>

      {loading && (
        <div className="card p-8 text-center text-sm text-ink-500">Loading cases…</div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          Could not load cases: {error}. Check that the API is running at {API_URL}.
        </div>
      )}

      {!loading && !error && cases.length === 0 && (
        <div className="card p-12 text-center">
          <p className="font-display text-lg text-ink-900">No cases yet</p>
          <p className="mt-1 text-sm text-ink-500">Analyze a case and it will show up here.</p>
          {onNew && (
            <button
              onClick={onNew}
              className="mt-5 rounded-full bg-ink-900 px-4 py-2.5 text-sm font-medium text-paper-50 transition hover:bg-ink-700"
            >
              Start a case
            </button>
          )}
        </div>
      )}

      {!loading && cases.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-paper-300 bg-paper-200">
                <tr className="text-left text-xs font-semibold text-ink-600">
                  <th className="px-5 py-3">ID</th>
                  <th className="px-5 py-3">Learner</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Recommendation</th>
                  <th className="px-5 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-paper-300">
                {cases.map((c) => (
                  <tr
                    key={c.id}
                    tabIndex={0}
                    onClick={() => onSelect(c.id)}
                    onKeyDown={(e) => e.key === 'Enter' && onSelect(c.id)}
                    className="cursor-pointer transition hover:bg-ember-50"
                  >
                    <td className="px-5 py-3.5 font-mono text-xs text-ink-500">#{c.id}</td>
                    <td className="px-5 py-3.5 font-medium text-ink-900">{c.learner_name}</td>
                    <td className="px-5 py-3.5"><StatusBadge status={c.status} /></td>
                    <td className="px-5 py-3.5"><RecBadge rec={c.recommendation} /></td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-xs text-ink-500">
                      {c.created_at ? new Date(c.created_at).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    'Waiting for Learner': 'bg-blue-50 text-blue-800 ring-blue-200',
    'Waiting for Mentor': 'bg-purple-50 text-purple-800 ring-purple-200',
    'Ready for Review': 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    Open: NEUTRAL,
    Closed: 'bg-paper-300 text-ink-500 ring-paper-400',
  }[status] || NEUTRAL;
  return (
    <span className={`inline-block rounded-md px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${styles}`}>
      {status || 'Open'}
    </span>
  );
}

function RecBadge({ rec }) {
  const map = {
    eligible: ['Eligible', 'bg-emerald-50 text-emerald-800 ring-emerald-200'],
    ineligible: ['Not eligible', 'bg-rose-50 text-rose-800 ring-rose-200'],
    on_hold: ['On hold', 'bg-orange-50 text-orange-800 ring-orange-200'],
    pending: ['Pending', 'bg-amber-50 text-amber-800 ring-amber-200'],
  };
  const [label, styles] = map[rec] || [rec ? String(rec).replace(/_/g, ' ') : 'Pending', NEUTRAL];
  return (
    <span className={`inline-block rounded-md px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${styles}`}>
      {label}
    </span>
  );
}