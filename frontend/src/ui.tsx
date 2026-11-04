// Shared UI kit, modelled on macOS. Every panel builds from these so spacing, radii and states stay consistent.
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ');

export const isMac = navigator.userAgent.includes('Mac');

export function IconButton({ icon: Icon, label, active, size = 15, className, ...rest }: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  size?: number;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      title={label}
      aria-label={label}
      className={cx(
        'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors disabled:opacity-30',
        active ? 'bg-text/12 text-text' : 'text-muted enabled:hover:bg-text/8 enabled:hover:text-text',
        className,
      )}
      {...rest}
    >
      <Icon size={size} strokeWidth={1.75} />
    </button>
  );
}

const buttonVariants = {
  primary: 'bg-accent text-bg shadow-sm hover:brightness-110 active:brightness-95',
  secondary: 'bg-text/10 text-text hover:bg-text/14 active:bg-text/18',
  ghost: 'text-muted hover:bg-text/8 hover:text-text',
  danger: 'text-danger hover:bg-danger/12',
};

// Capsule buttons, as in macOS 26 toolbars and sheets.
export function Button({ variant = 'secondary', icon: Icon, children, className, ...rest }: {
  variant?: keyof typeof buttonVariants;
  icon?: LucideIcon;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cx(
        'inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 font-medium transition disabled:pointer-events-none disabled:opacity-40',
        buttonVariants[variant],
        className,
      )}
      {...rest}
    >
      {Icon && <Icon size={14} strokeWidth={2} />}
      {children}
    </button>
  );
}

// macOS segmented control: recessed track, raised thumb.
export function Segmented<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex shrink-0 rounded-[9px] bg-text/8 p-[2px]">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'h-6 whitespace-nowrap rounded-[7px] px-3 text-xs font-medium transition-all',
            o.value === value ? 'bg-white text-black shadow-[0_1px_3px_rgb(0_0_0/0.18)] dark:bg-text/22 dark:text-text' : 'text-muted hover:text-text',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// Top bar inside a panel.
export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('flex h-11 min-w-0 shrink-0 items-center gap-2 overflow-hidden border-b border-border px-3', className)}>{children}</div>;
}

// Sentence case, like Finder's "Favorites" / "Locations".
export function SectionLabel({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex h-7 items-end justify-between px-4 pb-1 text-[11px] font-semibold text-muted">
      {children}
      {action}
    </div>
  );
}

// Source-list row (sidebars, host lists). Icons take the accent colour, like macOS sidebars.
export function ListRow({ icon: Icon, iconColor, title, subtitle, selected, trailing, onClick, className }: {
  icon?: LucideIcon;
  iconColor?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  selected?: boolean;
  trailing?: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <div
      onClick={onClick}
      className={cx(
        'group mx-2 flex cursor-default items-center gap-2.5 rounded-lg px-2',
        subtitle ? 'py-1.5' : 'h-7',
        selected ? 'bg-text/12' : 'hover:bg-text/6',
        className,
      )}
    >
      {Icon && <Icon size={16} strokeWidth={1.75} className="shrink-0 text-accent" style={iconColor ? { color: iconColor } : undefined} />}
      <div className="min-w-0 flex-1">
        <div className="truncate">{title}</div>
        {subtitle && <div className="truncate text-[11px] text-muted">{subtitle}</div>}
      </div>
      {trailing}
    </div>
  );
}

// System Settings style icon: white glyph on a coloured rounded square.
export function Tile({ icon: Icon, color, size = 20 }: { icon: LucideIcon; color: string; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-[6px] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25)]"
      style={{ width: size, height: size, background: `linear-gradient(180deg, color-mix(in oklab, ${color} 85%, white), ${color})` }}
    >
      <Icon size={size * 0.62} strokeWidth={2.25} />
    </span>
  );
}

const tones = {
  neutral: 'bg-text/10 text-muted',
  accent: 'bg-accent/16 text-accent',
  success: 'bg-success/16 text-success',
  warning: 'bg-warning/16 text-warning',
  danger: 'bg-danger/16 text-danger',
};
export type Tone = keyof typeof tones;

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={cx('inline-flex shrink-0 items-center rounded-full px-2 py-px text-[11px] font-medium', tones[tone])}>{children}</span>;
}

const dots = { neutral: 'bg-muted/60', accent: 'bg-accent', success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger' };

export function StatusDot({ tone = 'neutral' }: { tone?: Tone }) {
  return <span className={cx('inline-block h-2 w-2 shrink-0 rounded-full', dots[tone])} />;
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="whitespace-nowrap rounded-md bg-text/8 px-1.5 py-px font-sans text-[11px] text-muted">{children}</kbd>;
}

export function EmptyState({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1.5 p-6 text-center">
      <Icon size={36} strokeWidth={1.25} className="mb-1 text-muted/50" />
      <div className="text-[15px] font-semibold text-text">{title}</div>
      {body && <div className="max-w-xs text-muted">{body}</div>}
    </div>
  );
}

// Grouped inset list, as in System Settings: rounded container, rows split by inset hairlines.
export function Group({ title, footer, children }: { title?: string; footer?: string; children: ReactNode }) {
  return (
    <section className="mb-6">
      {title && <h3 className="mb-1.5 px-1 text-[13px] font-semibold text-text">{title}</h3>}
      <div className="divide-y divide-border rounded-xl bg-text/[0.045] px-3.5">{children}</div>
      {footer && <p className="mt-1.5 px-1 text-[11px] text-muted">{footer}</p>}
    </section>
  );
}

// One row of a Group: label on the left, control on the right.
export function GroupRow({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-11 items-center gap-4 py-2">
      <div className="min-w-0 flex-1">
        <div className="text-text">{label}</div>
        {hint && <div className="text-[11px] text-muted">{hint}</div>}
      </div>
      <div className="flex min-w-0 shrink-0 items-center justify-end gap-3">{children}</div>
    </div>
  );
}

// macOS switch.
export function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (on: boolean) => void; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cx('relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors disabled:cursor-default disabled:opacity-50', on ? 'bg-accent' : 'bg-text/20')}
    >
      <span className={cx('absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.3)] transition-all', on ? 'left-[18px]' : 'left-[2px]')} />
    </button>
  );
}

// Centered sheet with a title bar and optional footer, like a macOS sheet. Closes on backdrop click.
export function Sheet({ title, onClose, children, footer, width = 'w-[min(640px,94vw)]' }: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex animate-fade items-center justify-center bg-black/25" onMouseDown={onClose}>
      <div onMouseDown={(e) => e.stopPropagation()} className={cx('flex max-h-[88vh] animate-pop flex-col overflow-hidden rounded-[20px] bg-bg shadow-[0_30px_80px_-20px_rgb(0_0_0/0.6)] ring-1 ring-border', width)}>
        <div className="flex h-12 shrink-0 items-center px-5">
          <h2 className="flex-1 text-[15px] font-semibold tracking-tight">{title}</h2>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>
        {footer && <div className="flex shrink-0 items-center gap-2 border-t border-border px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

// Class strings for plain elements (inputs, tables).
export const field =
  'h-7 w-full rounded-lg bg-text/7 px-2.5 text-text outline-none ring-1 ring-transparent transition placeholder:text-muted/70 focus:bg-text/5 focus:ring-2 focus:ring-accent/50';
export const th = 'sticky top-0 z-10 h-8 bg-bg/95 px-3 text-left text-[11px] font-semibold text-muted backdrop-blur';
export const td = 'h-8 px-3';
export const row = 'even:bg-text/[0.035] hover:bg-text/7'; // zebra rows, like Finder list view
// Hides secondary columns and controls when the pane (not the window) is narrow. Panes are @container.
export const wideOnly = '@max-xl:hidden';
