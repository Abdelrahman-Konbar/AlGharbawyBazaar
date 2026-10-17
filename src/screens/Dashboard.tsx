import { ArrowUpRight, ScanLine, PackagePlus, Truck, AlertTriangle, ChevronLeft } from 'lucide-react'
import { useStore, useFmt, stockStatus, type Sale } from '../store'
import { useNav } from '../nav'
import { Button, Card, ProductMark, StockBadge, cx } from '../ui'

const DAY = 86400000
export const dayStart = (d: number) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime() }

export function aggregate(sales: Sale[]) {
  const revenue = sales.reduce((a, s) => a + s.total, 0)
  const cogs = sales.reduce((a, s) => a + s.cogs, 0)
  return { revenue, cogs, profit: revenue - cogs, margin: revenue ? ((revenue - cogs) / revenue) * 100 : 0, count: sales.length }
}

export function Bars({ data, height = 180, labels }: { data: { label: string; a: number; b: number }[]; height?: number; labels: [string, string] }) {
  const f = useFmt()
  const max = Math.max(1, ...data.map((d) => d.a))
  return (
    <div>
      <div className="flex items-end gap-[6px]" style={{ height }}>
        {data.map((d, i) => (
          <div key={i} className="group relative flex h-full flex-1 flex-col justify-end">
            <div className="pointer-events-none absolute -top-2 left-1/2 z-10 hidden -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-olive px-2.5 py-1.5 text-[11px] text-ivory shadow-lg group-hover:block">
              <p className="font-medium">{d.label}</p>
              <p className="num">{labels[0]}: {f.money(d.a)}</p>
              <p className="num text-amber">{labels[1]}: {f.money(d.b)}</p>
            </div>
            <div className="relative w-full overflow-hidden rounded-t-[5px] bg-[#e9e2d3] transition-all group-hover:bg-[#ddd3bf]" style={{ height: `${(d.a / max) * 100}%`, minHeight: d.a ? 3 : 0 }}>
              <div className="absolute inset-x-0 bottom-0 bg-forest transition-all group-hover:bg-forest-2" style={{ height: d.a ? `${(d.b / d.a) * 100}%` : 0 }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-[6px]">
        {data.map((d, i) => <span key={i} className="num flex-1 truncate text-center text-[10px] text-muted">{i % Math.ceil(data.length / 10) === 0 ? d.label : ''}</span>)}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { state, t, pname, lang } = useStore()
  const f = useFmt()
  const nav = useNav()
  const now = Date.now()
  const t0 = dayStart(now)
  const today = aggregate(state.sales.filter((s) => s.date >= t0))
  const yest = aggregate(state.sales.filter((s) => s.date >= t0 - DAY && s.date < t0))
  const week = state.sales.filter((s) => s.date >= t0 - 6 * DAY)
  const delta = yest.revenue ? ((today.revenue - yest.revenue) / yest.revenue) * 100 : 0
  const days = Array.from({ length: 14 }, (_, i) => {
    const s = t0 - (13 - i) * DAY
    const a = aggregate(state.sales.filter((x) => x.date >= s && x.date < s + DAY))
    return { label: new Date(s).toLocaleDateString(lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'short' }), a: a.revenue, b: a.profit }
  })
  const top: Record<string, { rev: number; qty: number; unit: any; id: string }> = {}
  week.forEach((s) => s.lines.forEach((l) => { const x = (top[l.productId] ??= { rev: 0, qty: 0, unit: l.unit, id: l.productId }); x.rev += l.total; x.qty += l.qty }))
  const topList = Object.values(top).sort((a, b) => b.rev - a.rev).slice(0, 5)
  const maxTop = topList[0]?.rev || 1
  const alerts = state.products.filter((p) => stockStatus(p) !== 'ok').sort((a, b) => a.stock / (a.lowStock || 1) - b.stock / (b.lowStock || 1))
  const stockValue = state.products.reduce((a, p) => a + (p.unit === 'weight' ? p.stock / 1000 : p.stock) * p.avgCost, 0)
  const hour = new Date().getHours()
  const greet = hour < 12 ? t('صباح الخير', 'Good morning') : t('مساء الخير', 'Good evening')

  return (
    <div className="space-y-6">
      {/* Hero ledger strip */}
      <section className="pattern relative overflow-hidden rounded-[22px] bg-forest p-8 text-ivory">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-sm text-ivory/60">{greet}، {state.settings.cashier.split(' ')[0]}</p>
            <p className="mt-5 text-[13px] uppercase tracking-[.18em] text-amber">{t('مبيعات اليوم', "Today's sales")}</p>
            <p className="num mt-1 text-[52px] font-semibold leading-none tracking-tight">{f.n2(today.revenue)}<span className="ms-2 text-xl font-normal text-ivory/50">{lang === 'ar' ? 'ج.م' : 'EGP'}</span></p>
            <p className="mt-3 flex items-center gap-2 text-sm text-ivory/70">
              <span className={cx('num inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', delta >= 0 ? 'bg-[#9fd3b4]/20 text-[#bfe6cd]' : 'bg-[#f0a090]/20 text-[#f6c2b7]')}>
                <ArrowUpRight size={13} className={delta < 0 ? 'rotate-90' : ''} />{f.pct(Math.abs(delta))}
              </span>
              {t('مقارنة بأمس', 'vs. yesterday')} · <span className="num">{f.money(yest.revenue)}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="amber" size="lg" icon={<ScanLine size={18} />} onClick={() => nav.go({ name: 'pos' })}>{t('افتح نقطة البيع', 'Open POS')}</Button>
            <Button size="lg" className="!border-ivory/15 !bg-ivory/10 !text-ivory hover:!bg-ivory/15" icon={<Truck size={18} />} onClick={() => nav.openStock('receive')}>{t('استلام بضاعة', 'Receive stock')}</Button>
          </div>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-ivory/10 md:grid-cols-4">
          {[
            [t('مجمل الربح اليوم', 'Gross profit today'), f.money(today.profit)],
            [t('هامش الربح', 'Gross margin'), f.pct(today.margin)],
            [t('عدد الفواتير', 'Invoices'), String(today.count)],
            [t('متوسط الفاتورة', 'Avg. basket'), f.money(today.count ? today.revenue / today.count : 0)],
          ].map(([k, v]) => (
            <div key={k} className="bg-forest/80 px-5 py-4">
              <p className="text-xs text-ivory/55">{k}</p>
              <p className="num mt-1 text-xl font-semibold">{v}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card className="p-6">
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-forest">{t('آخر ١٤ يوم', 'Last 14 days')}</h3>
              <p className="mt-0.5 text-[13px] text-muted">{t('المبيعات ومجمل الربح يومياً', 'Daily sales and gross profit')}</p>
            </div>
            <div className="flex gap-4 text-xs text-muted">
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-[#e9e2d3]" />{t('المبيعات', 'Sales')}</span>
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-forest" />{t('مجمل الربح', 'Gross profit')}</span>
            </div>
          </div>
          <Bars data={days} labels={[t('المبيعات', 'Sales'), t('الربح', 'Profit')]} />
        </Card>

        <Card className="flex flex-col p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-forest">{t('الأكثر مبيعاً هذا الأسبوع', 'Top sellers this week')}</h3>
            <button onClick={() => nav.go({ name: 'reports' })} className="text-[13px] font-medium text-[#8a5a1c] hover:underline cursor-pointer">{t('التقارير', 'Reports')}</button>
          </div>
          <div className="space-y-4">
            {topList.map((x, i) => {
              const p = state.products.find((p) => p.id === x.id)
              return (
                <button key={x.id} onClick={() => p && nav.go({ name: 'product', id: x.id })} className="block w-full text-start cursor-pointer">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2"><span className="num w-4 text-xs text-muted">{i + 1}</span>{p ? pname(p) : '—'}</span>
                    <span className="num font-medium">{f.money(x.rev)}</span>
                  </div>
                  <div className="ms-6 mt-1.5 h-1.5 rounded-full bg-[#f1ede4]"><div className="h-full rounded-full bg-amber" style={{ width: `${(x.rev / maxTop) * 100}%` }} /></div>
                </button>
              )
            })}
            {!topList.length && <p className="py-8 text-center text-sm text-muted">{t('لا مبيعات بعد', 'No sales yet')}</p>}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-6 pt-5 pb-3">
            <h3 className="flex items-center gap-2 font-semibold text-forest"><AlertTriangle size={16} className="text-amber" />{t('يحتاج إعادة طلب', 'Needs restocking')}</h3>
            <span className="num text-xs text-muted">{t('قيمة المخزون', 'Stock value')} · {f.money(stockValue)}</span>
          </div>
          {alerts.length === 0 ? <p className="px-6 py-10 text-center text-sm text-muted">{t('المخزون في حالة جيدة', 'Stock levels look healthy')}</p> : alerts.slice(0, 5).map((p) => (
            <div key={p.id} className="flex items-center gap-3 border-t border-line px-6 py-3">
              <ProductMark p={p} size={34} />
              <button onClick={() => nav.go({ name: 'product', id: p.id })} className="flex-1 text-start cursor-pointer">
                <p className="text-sm font-medium">{pname(p)}</p>
                <p className="num text-xs text-muted">{f.qty(p.unit, p.stock)} / {t('الحد', 'min')} {f.qty(p.unit, p.lowStock)}</p>
              </button>
              <StockBadge p={p} />
              <Button size="sm" icon={<PackagePlus size={14} />} onClick={() => nav.openStock('receive', p.id)}>{t('استلام', 'Receive')}</Button>
            </div>
          ))}
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-6 pt-5 pb-3">
            <h3 className="font-semibold text-forest">{t('آخر الفواتير', 'Recent invoices')}</h3>
            <button onClick={() => nav.go({ name: 'sales' })} className="inline-flex items-center gap-1 text-[13px] font-medium text-[#8a5a1c] hover:underline cursor-pointer">{t('عرض الكل', 'View all')}<ChevronLeft size={14} className="ltr:rotate-180" /></button>
          </div>
          {state.sales.slice(0, 6).map((s) => (
            <button key={s.id} onClick={() => nav.openSale(s.id)} className="flex w-full items-center gap-4 border-t border-line px-6 py-3 text-start hover:bg-[#fcfaf6] cursor-pointer">
              <span className="num w-20 text-sm font-medium text-forest">{s.number}</span>
              <span className="flex-1 truncate text-sm text-muted">{s.lines.map((l) => (lang === 'ar' ? l.nameAr : l.nameEn)).join('، ')}</span>
              <span className="num text-xs text-muted">{f.date(s.date) === f.date(now) ? f.time(s.date) : f.date(s.date)}</span>
              <span className="num w-28 text-end text-sm font-semibold">{f.money(s.total)}</span>
            </button>
          ))}
        </Card>
      </div>
    </div>
  )
}
