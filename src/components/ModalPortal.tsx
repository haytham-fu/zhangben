import { useEffect } from 'react';
import { createPortal } from 'react-dom';

/** Renders children on document.body so position:fixed is not trapped by .page-view transforms. */
export function ModalPortal({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}
