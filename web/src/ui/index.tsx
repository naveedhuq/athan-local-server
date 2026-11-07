import { Loader2, X } from 'lucide-react';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';

/* ───────── Card ───────── */
export function Card({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-3xl border border-line bg-surface shadow-card', className)} {...p} />;
}

export function SectionTitle({ title, hint, action, className }: { title: ReactNode; hint?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-end justify-between gap-3', className)}>
      <div className="min-w-0">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {hint && <p className="mt-0.5 text-sm text-muted">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-muted">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

/* ───────── Button ───────── */
type Variant = 'primary' | 'soft' | 'ghost' | 'outline' | 'danger';
type Size = 'sm' | 'md' | 'lg';
const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg hover:brightness-110 shadow-sm',
  soft: 'bg-accent-soft text-accent-strong hover:brightness-95 dark:hover:brightness-110',
  ghost: 'text-ink hover:bg-surface-2',
  outline: 'border border-line bg-surface text-ink hover:bg-surface-2',
  danger: 'bg-danger-soft text-danger hover:brightness-95 dark:hover:brightness-110',
};
const sizes: Record<Size, string> = { sm: 'h-9 px-3 text-sm gap-1.5 rounded-xl', md: 'h-11 px-4 text-sm gap-2 rounded-2xl', lg: 'h-12 px-6 text-base gap-2 rounded-2xl' };

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  icon,
  className,
  children,
  disabled,
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean; icon?: ReactNode }) {
  return (
    <button
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center font-medium transition active:scale-[.97] disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || loading}
      {...p}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

export function IconButton({
  label,
  variant = 'ghost',
  className,
  children,
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; variant?: Variant }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn('inline-flex size-10 shrink-0 items-center justify-center rounded-xl transition active:scale-95 disabled:opacity-50', variants[variant], className)}
      {...p}
    >
      {children}
    </button>
  );
}

/* ───────── Switch ───────── */
export function Switch({ checked, onChange, label, disabled, className }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean; className?: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors disabled:opacity-50',
        checked ? 'border-accent bg-accent' : 'border-line bg-surface-2',
        className,
      )}
    >
      <span className={cn('inline-block size-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[22px]' : 'translate-x-[3px]')} />
    </button>
  );
}

/* ───────── Slider ───────── */
export function Slider({
  value,
  onCommit,
  min = 0,
  max = 100,
  disabled,
  label,
  className,
}: {
  value: number;
  onCommit: (v: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  label: string;
  className?: string;
}) {
  const [local, setLocal] = useState(value);
  const dragging = useRef(false);
  useEffect(() => {
    if (!dragging.current) setLocal(value);
  }, [value]);
  const pct = ((local - min) / (max - min)) * 100;
  const commit = () => {
    dragging.current = false;
    if (local !== value) onCommit(local);
  };
  return (
    <input
      type="range"
      aria-label={label}
      className={cn('slider', className)}
      style={{ ['--pct' as string]: `${pct}%` }}
      min={min}
      max={max}
      value={local}
      disabled={disabled}
      onChange={(e) => {
        dragging.current = true;
        setLocal(Number(e.target.value));
      }}
      onPointerUp={commit}
      onKeyUp={commit}
      onBlur={commit}
    />
  );
}

/* ───────── Badge / Chip ───────── */
export function Badge({ tone = 'neutral', className, ...p }: HTMLAttributes<HTMLSpanElement> & { tone?: 'neutral' | 'accent' | 'gold' | 'danger' | 'ok' }) {
  const tones = {
    neutral: 'bg-surface-2 text-muted',
    accent: 'bg-accent-soft text-accent-strong',
    gold: 'bg-gold-soft text-gold',
    danger: 'bg-danger-soft text-danger',
    ok: 'bg-accent-soft text-ok',
  };
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium', tones[tone], className)} {...p} />;
}

export function Chip({ active, children, className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      aria-pressed={active}
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition active:scale-95 disabled:opacity-50',
        active ? 'border-accent bg-accent-soft text-accent-strong' : 'border-line bg-surface text-muted hover:text-ink',
        className,
      )}
      {...p}
    >
      {children}
    </button>
  );
}

export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: Array<{ value: T; label: ReactNode }>; className?: string }) {
  return (
    <div role="radiogroup" className={cn('inline-flex rounded-2xl border border-line bg-surface-2 p-1', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn('h-9 rounded-xl px-3.5 text-sm font-medium transition', o.value === value ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ───────── Inputs ───────── */
const fieldBase =
  'h-11 w-full rounded-2xl border border-line bg-surface px-3.5 text-sm text-ink placeholder:text-muted/70 transition focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15 disabled:opacity-50';

export function Input({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldBase, className)} {...p} />;
}

export function Select({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select className={cn(fieldBase, 'appearance-none pr-10', className)} {...p}>
        {children}
      </select>
      <svg className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="m5 8 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  const id = useId();
  return (
    <div className={cn('block', className)}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <div id={id}>{children}</div>
      {hint && <p className="mt-1.5 text-xs leading-relaxed text-muted">{hint}</p>}
    </div>
  );
}

export function Row({ title, hint, children, className }: { title: ReactNode; hint?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center justify-between gap-4 py-3', className)}>
      <div className="min-w-0">
        <div className="text-sm font-medium">{title}</div>
        {hint && <div className="mt-0.5 text-xs leading-relaxed text-muted">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

/* ───────── Modal / bottom sheet ───────── */
export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="animate-fade absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cn(
          'animate-pop relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl border border-line bg-surface shadow-card sm:rounded-3xl',
          wide ? 'sm:max-w-2xl' : 'sm:max-w-lg',
        )}
      >
        <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-5">
          <h2 className="text-lg font-semibold">{title}</h2>
          <IconButton label="Close" onClick={onClose}>
            <X className="size-5" />
          </IconButton>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-3">{children}</div>
        {footer && <div className="pb-safe flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/* ───────── Misc ───────── */
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('size-5 animate-spin text-muted', className)} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />;
}

export function Empty({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-line px-6 py-12 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-accent-soft text-accent">{icon}</div>
      <h3 className="text-lg font-semibold">{title}</h3>
      {children && <p className="max-w-md text-sm leading-relaxed text-muted">{children}</p>}
      {action}
    </div>
  );
}

export function Notice({ tone = 'info', children, className }: { tone?: 'info' | 'warn'; children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-2xl border px-4 py-3 text-sm leading-relaxed', tone === 'warn' ? 'border-gold/40 bg-gold-soft text-ink' : 'border-line bg-surface-2 text-muted', className)}>{children}</div>
  );
}

export function Equalizer({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex h-4 items-end gap-0.5', className)} aria-hidden>
      {[0, 0.2, 0.4, 0.1].map((d, i) => (
        <span key={i} className="eq-bar w-[3px] rounded-full bg-current" style={{ height: '100%', animationDelay: `${d}s` }} />
      ))}
    </span>
  );
}
