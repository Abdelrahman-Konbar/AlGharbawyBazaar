import { createContext, useContext, useEffect, useState, type ReactNode, type ButtonHTMLAttributes } from 'react'
import { X, CheckCircle2, AlertTriangle, Info, PackageOpen } from 'lucide-react'
import { useStore, stockStatus, type Product } from './store'

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ')

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'amber'; size?: 'sm' | 'md' | 'lg'; icon?: ReactNode }
export function Button({ variant = 'secondary', size = 'md', icon, className, children, ...rest }: BtnProps) {
  const v = {
    primary: 'bg-forest text-ivory hover:bg-forest-2 shadow-[0_1px_0_rgba(255,255,255,.12)_inset,0_1px_2px_rgba(31,64,53,.3)]',
    amber: 'bg-amber text-forest hover:brightness-105 shadow-[0_1px_2px_rgba(206,152,83,.4)]',
    secondary: 'bg-white text-olive border border-line hover:border-[#d6cdbd] hover:bg-[#fdfbf7]',
    ghost: 'text-olive hover:bg-black/[.04]',
    danger: 'bg-[#a63d2f] text-white hover:bg-[#8f3327]',
  }[variant]
  const s = { sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-lg', md: 'h-10 px-4 text-sm gap-2 rounded-[10px]', lg: 'h-12 px-5 text-[15px] gap-2 rounded-xl' }[size]
  return (
    <button {...rest} className={cx('inline-flex items-center justify-center font-medium transition-all active:scale-[.98] disabled:opacity-45 disabled:pointer-events-none whitespace-nowrap select-none cursor-pointer', v, s, className)}>
      {icon}
      {children}
    </button>
  )
}

export const inputCls = 'w-full h-10 rounded-[10px] border border-line bg-white px-3 text-sm text-olive placeholder:text-[#a7ae9f] outline-none transition focus:border-forest focus:ring-4 focus:ring-forest/10'

export function Field({ label, error, hint, children, className }: { label: string; error?: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1.5 block text-[13px] font-medium text-olive/80">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs text-[#a63d2f]">{error}</span> : hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  )
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('rounded-2xl border border-line bg-white', className)}>{children}</div>
}

export function Badge({ tone = 'neutral', children, dot }: { tone?: 'neutral' | 'green' | 'amber' | 'red' | 'forest'; children: ReactNode; dot?: boolean }) {
  const c = {
    neutral: 'bg-[#f1ede4] text-olive/80',
    green: 'bg-[#e6f0e9] text-[#2c6a4c]',
    amber: 'bg-amber-soft text-[#8a5a1c]',
    red: 'bg-[#f8e3df] text-[#a63d2f]',
    forest: 'bg-forest text-ivory',
  }[tone]
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', c)}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}

export function StockBadge({ p }: { p: Product }) {
  const { t } = useStore()
  const s = stockStatus(p)
  if (s === 'out') return <Badge tone="red" dot>{t('نفد', 'Out of stock')}</Badge>
  if (s === 'low') return <Badge tone="amber" dot>{t('منخفض', 'Low stock')}</Badge>
  return <Badge tone="green" dot>{t('متوفر', 'In stock')}</Badge>
}

export function Modal({ open, onClose, title, subtitle, children, footer, width = 'max-w-lg' }: { open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode; width?: string }) {
  useEsc(open, onClose)
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-olive/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className={cx('anim-pop relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl', width)}>
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
          <div>
            <h3 className="text-[17px] font-semibold text-forest">{title}</h3>
            {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="-me-2 rounded-lg p-1.5 text-muted hover:bg-black/5 cursor-pointer"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line bg-[#fcfaf6] px-6 py-3.5">{footer}</div>}
      </div>
    </div>
  )
}

export function Drawer({ open, onClose, title, subtitle, children, footer }: { open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  useEsc(open, onClose)
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-olive/35" onClick={onClose} />
      <div className="anim-drawer absolute inset-y-0 end-0 flex w-full max-w-[560px] flex-col bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-line px-7 py-5">
          <div>
            <h3 className="text-lg font-semibold text-forest">{title}</h3>
            {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-black/5 cursor-pointer"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-7 py-6">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line bg-[#fcfaf6] px-7 py-4">{footer}</div>}
      </div>
    </div>
  )
}

function useEsc(open: boolean, fn: () => void) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && fn()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, fn])
}

export function Confirm({ open, title, body, confirmLabel, danger, onConfirm, onClose }: { open: boolean; title: string; body: ReactNode; confirmLabel: string; danger?: boolean; onConfirm: () => void; onClose: () => void }) {
  const { t } = useStore()
  return (
    <Modal open={open} onClose={onClose} title={title} width="max-w-md"
      footer={<><Button variant="ghost" onClick={onClose}>{t('إلغاء', 'Cancel')}</Button><Button variant={danger ? 'danger' : 'primary'} onClick={() => { onConfirm(); onClose() }}>{confirmLabel}</Button></>}>
      <div className="text-sm leading-relaxed text-olive/80">{body}</div>
    </Modal>
  )
}

export function Empty({ title, body, action, icon }: { title: string; body?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-amber-soft text-[#8a5a1c]">{icon ?? <PackageOpen size={24} />}</div>
      <p className="font-semibold text-forest">{title}</p>
      {body && <p className="mt-1 max-w-xs text-sm text-muted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; className?: string }) {
  return (
    <div className={cx('inline-flex rounded-[10px] border border-line bg-[#f3efe6] p-0.5', className)}>
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          className={cx('h-8 rounded-lg px-3 text-[13px] font-medium transition cursor-pointer whitespace-nowrap', value === o.value ? 'bg-white text-forest shadow-sm' : 'text-olive/60 hover:text-olive')}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[26px] font-semibold tracking-tight text-forest">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export const th = 'px-4 py-3 text-start text-[12px] font-medium uppercase tracking-wide text-muted whitespace-nowrap'
export const td = 'px-4 py-3.5 text-sm whitespace-nowrap'

/* Toasts */
type Toast = { id: number; tone: 'success' | 'error' | 'info'; msg: string }
const ToastCtx = createContext<(msg: string, tone?: Toast['tone']) => void>(() => {})
export const useToast = () => useContext(ToastCtx)
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])
  const push = (msg: string, tone: Toast['tone'] = 'success') => {
    const id = Date.now() + Math.random()
    setItems((x) => [...x, { id, tone, msg }])
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 3200)
  }
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2">
        {items.map((i) => (
          <div key={i.id} className="anim-up pointer-events-auto flex items-center gap-2.5 rounded-xl bg-olive px-4 py-3 text-sm text-ivory shadow-xl">
            {i.tone === 'success' ? <CheckCircle2 size={17} className="text-[#9fd3b4]" /> : i.tone === 'error' ? <AlertTriangle size={17} className="text-[#f0a090]" /> : <Info size={17} className="text-amber" />}
            {i.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export function ProductMark({ p, size = 40 }: { p: { nameEn: string; category: string }; size?: number }) {
  const tones: Record<string, string> = { nuts: '#efe0c6', seeds: '#e3e9d9', dried: '#f3dccd', snacks: '#f4ebc4', sweets: '#efdcdc', coffee: '#e0d6cb' }
  const ink: Record<string, string> = { nuts: '#8a5a1c', seeds: '#4c6a3a', dried: '#9a4a2a', snacks: '#7c6416', sweets: '#8f3f4a', coffee: '#5a3e2b' }
  return (
    <div className="grid shrink-0 place-items-center rounded-xl font-semibold num" style={{ width: size, height: size, background: tones[p.category] ?? '#eee', color: ink[p.category] ?? '#333', fontSize: size * 0.36 }}>
      {p.nameEn.replace(/[^A-Za-z ]/g, '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('')}
    </div>
  )
}

export function Logo({ light, compact }: { light?: boolean; compact?: boolean }) {
  const { t } = useStore()
  return (
    <div className="flex items-center gap-3">
      <div className={cx('relative grid size-10 shrink-0 place-items-center rounded-full border-2', light ? 'border-amber text-amber' : 'border-forest text-forest')}>
        <span className="text-[19px] font-bold leading-none" style={{ fontFamily: 'IBM Plex Sans Arabic' }}>غ</span>
        <span className={cx('absolute -bottom-0.5 size-2 rounded-full', light ? 'bg-amber' : 'bg-amber')} />
      </div>
      {!compact && (
        <div className="leading-tight">
          <p className={cx('text-[15px] font-semibold', light ? 'text-ivory' : 'text-forest')}>{t('بازار الغرباوي', 'Al-Gharbawy Bazaar')}</p>
          <p className={cx('text-[11px] tracking-wide', light ? 'text-ivory/55' : 'text-muted')}>{t('مكسرات وبن وحلويات', 'Nuts · Coffee · Sweets')}</p>
        </div>
      )}
    </div>
  )
}
