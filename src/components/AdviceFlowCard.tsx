interface Props {
  title: string;
  items: string[];
  /** When false, skip fluid animation classes (reduced motion / static pref) */
  animated: boolean;
}

/** Top-of-dashboard advice with soft Gemini-like flowing gradient mesh. */
export function AdviceFlowCard({ title, items, animated }: Props) {
  return (
    <section
      className={`advice-flow${animated ? ' advice-flow--animated' : ''}`}
      aria-label={title}
    >
      <div className="advice-flow-mesh" aria-hidden>
        <span className="advice-blob advice-blob-a" />
        <span className="advice-blob advice-blob-b" />
        <span className="advice-blob advice-blob-c" />
      </div>
      <div className="advice-flow-inner">
        <h2 className="advice-flow-title">{title}</h2>
        <ul className="advice-list advice-flow-list">
          {items.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
