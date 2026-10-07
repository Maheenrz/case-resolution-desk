export function Toast({ message, kind = 'info' }) {
  const bg = kind === 'error' ? 'bg-rose-700' : 'bg-ink-900';

  const icon = {
    success: (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </span>
    ),
    error: (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </span>
    ),
    info: null,
  }[kind];

  return (
    <div role="status" aria-live="polite" className="fixed bottom-6 right-6 z-50 animate-[slideUp_0.2s_ease-out]">
      <div className={`flex items-center gap-3 rounded-xl px-5 py-3 text-paper-50 shadow-card ${bg}`}>
        {icon}
        <span className="text-sm font-medium">{message}</span>
      </div>
    </div>
  );
}