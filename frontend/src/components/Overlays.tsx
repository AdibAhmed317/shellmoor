import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react';
// Rendered once in Workspace; driven by the helpers in store/overlays.ts.
import { closeMenu, dismissToast, useOverlays } from '../store/overlays';
import { Button, cx, field } from '../ui';

// Context menu, clamped to the window so it never opens off-screen.
function ContextMenu() {
  const menu = useOverlays((s) => s.menu);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  useLayoutEffect(() => {
    if (!menu || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos({ x: Math.min(menu.x, innerWidth - r.width - 8), y: Math.min(menu.y, innerHeight - r.height - 8) });
  }, [menu]);

  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeMenu();
    window.addEventListener('keydown', onKey);
    window.addEventListener('blur', closeMenu);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('blur', closeMenu);
    };
  }, [menu]);

  if (!menu) return null;
  return (
    <div className="fixed inset-0 z-[60]" onMouseDown={closeMenu} onContextMenu={(e) => (e.preventDefault(), closeMenu())}>
      <div
        ref={ref}
        onMouseDown={(e) => e.stopPropagation()}
        style={{ left: pos.x, top: pos.y }}
        className="glass absolute min-w-52 animate-pop rounded-xl p-1.5"
      >
        {menu.items.map((item, i) =>
          item === 'separator' ? (
            <div key={i} className="mx-2 my-1 border-t border-border" />
          ) : (
            <button
              key={i}
              disabled={item.disabled}
              onClick={() => {
                closeMenu();
                item.onSelect();
              }}
              className={cx(
                'flex h-7 w-full items-center gap-2.5 rounded-md px-2.5 text-left disabled:opacity-35',
                item.danger ? 'text-danger enabled:hover:bg-danger enabled:hover:text-white' : 'enabled:hover:bg-accent enabled:hover:text-bg',
              )}
            >
              {item.icon ? <item.icon size={14} strokeWidth={1.9} /> : <span className="w-3.5" />}
              <span className="flex-1">{item.label}</span>
              {item.shortcut && <span className="text-[11px] opacity-60">{item.shortcut}</span>}
            </button>
          ),
        )}
      </div>
    </div>
  );
}

// macOS-style alert: icon, bold title, message, buttons. Used for confirm() and prompt().
function Dialog() {
  const dialog = useOverlays((s) => s.dialog);
  const [value, setValue] = useState('');
  useEffect(() => {
    setValue(dialog?.kind === 'prompt' ? dialog.value : '');
  }, [dialog]);
  if (!dialog) return null;

  const close = (ok: boolean) => {
    useOverlays.setState({ dialog: null });
    if (dialog.kind === 'confirm') dialog.resolve(ok);
    else dialog.resolve(ok && value.trim() ? value.trim() : null);
  };
  const destructive = dialog.kind === 'confirm' && dialog.destructive;

  return (
    <div
      className="fixed inset-0 z-[70] flex animate-fade items-center justify-center bg-black/30"
      onMouseDown={() => close(false)}
      // Enter presses whichever button has focus (native behaviour); Escape always cancels.
      onKeyDown={(e) => e.key === 'Escape' && close(false)}
    >
      <div onMouseDown={(e) => e.stopPropagation()} className="glass w-[min(340px,90vw)] animate-pop rounded-2xl p-5 text-center">
        <div className={cx('mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl', destructive ? 'bg-danger/15 text-danger' : 'bg-accent/15 text-accent')}>
          {destructive ? <TriangleAlert size={26} /> : <Info size={26} />}
        </div>
        <div className="text-[15px] font-semibold text-text">{dialog.title}</div>
        {dialog.message && <p className="mt-1.5 text-muted">{dialog.message}</p>}
        {dialog.kind === 'prompt' && (
          <input
            autoFocus
            value={value}
            placeholder={dialog.placeholder}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && close(true)}
            className={`${field} mt-3 text-left`}
          />
        )}
        <div className="mt-5 grid grid-cols-2 gap-2">
          {/* Destructive dialogs focus Cancel so a stray Enter can't delete anything. */}
          <Button onClick={() => close(false)} className="justify-center" autoFocus={destructive}>
            Cancel
          </Button>
          <Button
            variant="primary"
            autoFocus={dialog.kind === 'confirm' && !destructive}
            onClick={() => close(true)}
            className={cx('justify-center', destructive && '!bg-danger !text-white')}
            disabled={dialog.kind === 'prompt' && !value.trim()}
          >
            {dialog.confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

const toneIcon = { neutral: Info, accent: Info, success: CircleCheck, warning: TriangleAlert, danger: CircleAlert };
const toneColor = { neutral: 'text-muted', accent: 'text-accent', success: 'text-success', warning: 'text-warning', danger: 'text-danger' };

function Toaster() {
  const toasts = useOverlays((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed bottom-10 right-4 z-[80] flex w-80 flex-col gap-2">
      {toasts.map((t) => {
        const Icon = toneIcon[t.tone];
        return (
          <div key={t.id} className="glass pointer-events-auto flex animate-pop items-start gap-2.5 rounded-xl p-3">
            <Icon size={16} className={cx('mt-px shrink-0', toneColor[t.tone])} />
            <div className="min-w-0 flex-1">
              <div className="font-medium text-text">{t.message}</div>
              {t.description && <div className="mt-0.5 text-xs text-muted">{t.description}</div>}
              {t.action && (
                <button onClick={() => (t.action!.run(), dismissToast(t.id))} className="mt-1.5 text-xs font-semibold text-accent hover:underline">
                  {t.action.label}
                </button>
              )}
            </div>
            <button onClick={() => dismissToast(t.id)} className="text-muted hover:text-text" aria-label="Dismiss">
              <X size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default function Overlays() {
  return (
    <>
      <ContextMenu />
      <Dialog />
      <Toaster />
    </>
  );
}
