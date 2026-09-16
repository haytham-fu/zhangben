import type { ReactNode } from 'react';

interface Props {
  icon: ReactNode;
  title: string;
  hint?: string;
}

export function EmptyState({ icon, title, hint }: Props) {
  return (
    <div className="empty empty-cute">
      <div className="empty-icon" aria-hidden>
        {icon}
      </div>
      <p className="empty-title">{title}</p>
      {hint ? <p className="empty-hint">{hint}</p> : null}
    </div>
  );
}
