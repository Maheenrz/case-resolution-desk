import { useRef, useState } from 'react';
import CaseForm from './CaseForm';
import Analysis from './Analysis';
import History from './History';
import { Toast } from './Toast';
import { getCase } from './api';

export default function App() {
  const [view, setView] = useState('form');
  const [result, setResult] = useState(null);
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  const showToast = (msg, kind = 'info') => {
    clearTimeout(timer.current);
    setToast({ msg, kind });
    timer.current = setTimeout(() => setToast(null), 3500);
  };

  const openCase = async (id) => {
    try {
      const { data } = await getCase(id);
      setResult({
        ...data,
        case_id: data.id,
        recommendation: data.rule_outcome?.recommendation,
        citations: data.rule_outcome?.citations,
        missing_facts: data.rule_outcome?.missing_facts,
        next_action: data.rule_outcome?.next_action,
        llm_explanation: data.llm_explanation,
        notes: data.notes || [],
      });
      setView('analysis');
    } catch (e) {
      showToast(e.message || 'Failed to load case', 'error');
    }
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-paper-300/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ember-500">
              <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="8" y="2" width="8" height="4" rx="1" />
                <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
                <path d="M9 14l2 2 4-4" />
              </svg>
            </div>
            <div>
              <h1 className="font-display text-[17px] font-semibold leading-tight tracking-tight text-ink-900">Case Resolution Desk</h1>
              <p className="text-xs text-ink-500">SkillBridge helpdesk</p>
            </div>
          </div>

          <nav className="flex items-center gap-1">
            <TabButton active={view === 'form'} onClick={() => setView('form')}>New case</TabButton>
            <TabButton active={view === 'history'} onClick={() => setView('history')}>History</TabButton>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        {view === 'form' && (
          <CaseForm
            onResult={(r) => {
              setResult(r);
              setView('analysis');
              showToast('Case analyzed and saved', 'success');
            }}
            onError={(msg) => showToast(msg, 'error')}
          />
        )}
        {view === 'analysis' && result && <Analysis data={result} onBack={() => setView('form')} />}
        {view === 'history' && <History onSelect={openCase} onNew={() => setView('form')} />}
      </main>

      <footer className="mx-auto max-w-5xl px-6 py-10 text-center text-xs text-ink-500">
        Rule outcomes are computed in code. The LLM only explains them.
      </footer>

      {toast && <Toast message={toast.msg} kind={toast.kind} />}
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
        active ? 'bg-ink-900 text-white' : 'text-ink-600 hover:bg-paper-200 hover:text-ink-900'
      }`}
    >
      {children}
    </button>
  );
}