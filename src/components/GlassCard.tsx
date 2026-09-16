import type { ReactNode } from 'react';

interface Props {
  title?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}

export function GlassCard({ title, children, className = '', action }: Props) {
  return (
    <section className={`glass ${className}`.trim()}>
      {(title || action) && (
        <div className="glass-head">
          {title ? (
            <h2 className="glass-title" style={{ marginBottom: action ? 10 : undefined }}>
              {title}
            </h2>
          ) : (
            <span />
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
