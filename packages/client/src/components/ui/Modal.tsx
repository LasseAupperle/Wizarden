import type { ReactNode } from 'react';
import { Overlay } from './Overlay.js';
import { IconButton } from './IconButton.js';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** bottom sheet instead of centered modal */
  sheet?: boolean;
}

/** Modal (centered) or Sheet (bottom) — both share the accessible Overlay base. */
export function Modal({ open, onClose, title, children, sheet }: Props) {
  const titleId = title ? `modal-${title.replace(/\s+/g, '-').toLowerCase()}` : undefined;
  return (
    <Overlay open={open} onClose={onClose} placement={sheet ? 'bottom' : 'center'} labelledBy={titleId}>
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3">
        <h2 id={titleId} className="font-display text-lg text-ink">
          {title}
        </h2>
        <IconButton label="Close" onClick={onClose}>
          ✕
        </IconButton>
      </header>
      <div className="p-4">{children}</div>
    </Overlay>
  );
}

export function Sheet(props: Omit<Props, 'sheet'>) {
  return <Modal {...props} sheet />;
}
