import { useEffect, useRef } from 'react';
import { Icon } from './Icon';
import { IconButton } from './IconButton';

/**
 * Centered modal dialog. Handles the accessibility plumbing production
 * dialogs need: `role="dialog"` + `aria-modal`, Escape to close, focus
 * moved to the dialog on open, and returned to the trigger element on
 * close. Clicking the overlay also closes it.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {string} props.title
 * @param {string} [props.icon]
 * @param {React.ReactNode} props.children
 *
 * @example
 * <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add Staff Account" icon="person_add">
 *   <TextField label="First Name" ... />
 *   <Button fullWidth onClick={submit}>Create Account</Button>
 * </Modal>
 */
export function Modal({ open, onClose, title, icon, children }) {
  const dialogRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    triggerRef.current = document.activeElement;
    dialogRef.current?.focus();
    const onKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
      if (triggerRef.current instanceof HTMLElement) triggerRef.current.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <button className="overlay" aria-label="Close dialog" onClick={onClose} />
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" ref={dialogRef} tabIndex={-1}>
        <h2 id="modal-title">
          {icon && <Icon name={icon} />}
          {title}
          <IconButton icon="close" label="Close" onClick={onClose} style={{ marginLeft: 'auto' }} />
        </h2>
        {children}
      </div>
    </>
  );
}
