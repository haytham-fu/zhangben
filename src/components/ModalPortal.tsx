import { useEffect } from 'react';
import { createPortal } from 'react-dom';

let modalOpenCount = 0;

/** Renders children on document.body so position:fixed is not trapped by .page-view transforms. */
export function ModalPortal({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    modalOpenCount += 1;
    document.documentElement.dataset.modalOpen = 'true';
    return () => {
      modalOpenCount = Math.max(0, modalOpenCount - 1);
      if (modalOpenCount === 0) {
        document.body.style.overflow = prev;
        delete document.documentElement.dataset.modalOpen;
      } else {
        document.body.style.overflow = 'hidden';
      }
    };
  }, []);

  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}
