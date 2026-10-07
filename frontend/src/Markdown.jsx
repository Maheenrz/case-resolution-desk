import { useMemo } from 'react';

// Tiny dependency-free renderer: headings, bold, italic, inline code,
// bullet / numbered lists, quotes and dividers. No raw #, * or - ever shows.

const TOKEN = /(\*\*[^*\n]+\*\*|__[^_\n]+__|`[^`\n]+`|\*[^*\s][^*\n]*\*)/g;
const strip = (s) => s.replace(/\*+/g, '').replace(/__/g, '');

export function Inline({ text }) {
  return String(text ?? '').split(TOKEN).map((p, i) => {
    if (!p) return null;
    if (/^(\*\*|__).+(\*\*|__)$/.test(p))
      return <strong key={i} className="font-semibold text-ink-900">{strip(p)}</strong>;
    if (/^`.+`$/.test(p))
      return (
        <code key={i} className="rounded bg-paper-200 px-1.5 py-0.5 font-mono text-[13px] text-ink-800">
          {p.slice(1, -1)}
        </code>
      );
    if (/^\*.+\*$/.test(p)) return <em key={i}>{strip(p)}</em>;
    return strip(p);
  });
}

function parse(src) {
  const blocks = [];
  let para = [], quote = [], list = null;
  const flush = () => {
    if (para.length) blocks.push({ t: 'p', text: para.join(' ') });
    if (quote.length) blocks.push({ t: 'q', text: quote.join(' ') });
    if (list) blocks.push(list);
    para = []; quote = []; list = null;
  };

  for (const raw of String(src ?? '').replace(/\r/g, '').split('\n')) {
    const line = raw.trimEnd();
    let m;
    if (!line.trim()) flush();
    else if ((m = line.match(/^\s*#{1,6}\s+(.*?)\s*#*$/))) {
      flush();
      blocks.push({ t: 'h', level: line.trim().match(/^#+/)[0].length, text: m[1] });
    } else if (/^\s*([-*_])(\s*\1){2,}$/.test(line)) {
      flush();
      blocks.push({ t: 'hr' });
    } else if ((m = line.match(/^(\s*)([-*•+]|\d+[.)])\s+(.*)$/))) {
      const type = /\d/.test(m[2]) ? 'ol' : 'ul';
      if (!list || list.t !== type) { flush(); list = { t: type, items: [] }; }
      list.items.push({ text: m[3], depth: Math.min(Math.floor(m[1].length / 2), 2), n: parseInt(m[2], 10) });
    } else if (list && /^\s{2,}\S/.test(line)) {
      list.items[list.items.length - 1].text += ' ' + line.trim();
    } else if ((m = line.match(/^>\s?(.*)$/))) {
      if (para.length || list) flush();
      quote.push(m[1]);
    } else {
      if (list || quote.length) flush();
      para.push(line.trim());
    }
  }
  flush();
  return blocks;
}

export default function Markdown({ text, className = '' }) {
  const blocks = useMemo(() => parse(text), [text]);

  return (
    <div className={`space-y-3.5 ${className}`}>
      {blocks.map((b, i) => {
        if (b.t === 'h') {
          const Tag = b.level <= 2 ? 'h3' : 'h4';
          return (
            <Tag
              key={i}
              className={b.level <= 2
                ? 'pt-2 font-display text-lg font-medium text-ink-900'
                : 'pt-1 text-[15px] font-semibold text-ink-900'}
            >
              <Inline text={b.text} />
            </Tag>
          );
        }
        if (b.t === 'hr') return <hr key={i} className="border-paper-300" />;
        if (b.t === 'q')
          return (
            <blockquote key={i} className="border-l-2 border-ember-500 pl-4 text-[15px] leading-7 text-ink-600">
              <Inline text={b.text} />
            </blockquote>
          );
        if (b.t === 'ul')
          return (
            <ul key={i} className="space-y-1.5">
              {b.items.map((it, j) => (
                <li key={j} style={{ marginLeft: it.depth * 18 }} className="flex gap-3 text-[15px] leading-7 text-ink-700">
                  <span aria-hidden className="mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full bg-ember-500" />
                  <span><Inline text={it.text} /></span>
                </li>
              ))}
            </ul>
          );
        if (b.t === 'ol')
          return (
            <ol key={i} className="space-y-2">
              {b.items.map((it, j) => (
                <li key={j} style={{ marginLeft: it.depth * 18 }} className="flex gap-3 text-[15px] leading-7 text-ink-700">
                  <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink-900 text-[11px] font-semibold text-paper-100">
                    {Number.isNaN(it.n) ? j + 1 : it.n}
                  </span>
                  <span><Inline text={it.text} /></span>
                </li>
              ))}
            </ol>
          );
        return (
          <p key={i} className="text-[15px] leading-7 text-ink-700">
            <Inline text={b.text} />
          </p>
        );
      })}
    </div>
  );
}