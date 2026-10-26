export default function PageHeader({ kicker, title, meta, children }: { kicker?: string; title: React.ReactNode; meta?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col" style={{ gap: 8, paddingBottom: 8 }}>
      {kicker && <span className="kicker" style={{ fontSize: 12 }}>{kicker}</span>}
      <h1 style={{ margin: 0, fontWeight: 500, fontSize: 'clamp(30px, 4vw, 40px)', lineHeight: 1.1, letterSpacing: '-0.02em' }}>{title}</h1>
      {meta && <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted)' }}>{meta}</p>}
      {children}
    </div>
  );
}

export const pageWrap: React.CSSProperties = { maxWidth: 880, margin: '0 auto', padding: '36px clamp(16px, 3vw, 24px) 64px', display: 'flex', flexDirection: 'column', gap: 20 };

export function EmptyState({ title, body, icon }: { title: string; body?: string; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center" style={{ gap: 10, padding: '56px 16px', border: '1px dashed var(--border-highlight)', borderRadius: 20 }}>
      {icon && <span style={{ color: 'var(--text-faint)' }}>{icon}</span>}
      <p style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 22 }}>{title}</p>
      {body && <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted)', maxWidth: 360, lineHeight: 1.5 }}>{body}</p>}
    </div>
  );
}
