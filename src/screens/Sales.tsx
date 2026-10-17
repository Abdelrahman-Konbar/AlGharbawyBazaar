import { useMemo, useState } from 'react'
import { Search, Printer, ReceiptText, CheckCircle2, ScanLine } from 'lucide-react'
import { useStore, useFmt } from '../store'
import { useNav } from '../nav'
import { Button, Card, Modal, PageHeader, Segmented, Empty, inputCls, th, td, Logo } from '../ui'
import { aggregate, dayStart } from './Dashboard'

export function rangeFilter(range: string, from?: string, to?: string) {
  const t0 = dayStart(Date.now())
  const D = 86400000
  if (range === 'today') return [t0, Infinity]
  if (range === '7') return [t0 - 6 * D, Infinity]
  if (range === '30') return [t0 - 29 * D, Infinity]
  if (range === 'custom') return [from ? new Date(from + 'T00:00').getTime() : 0, to ? new Date(to + 'T00:00').getTime() + D : Infinity]
  return [0, Infinity]
}

export function SalesHistory() {
  const { state, t, lang } = useStore()
  const f = useFmt()
  const nav = useNav()
  const [q, setQ] = useState('')
  const [range, setRange] = useState('7')
  const list = useMemo(() => {
    const [a, b] = rangeFilter(range)
    const s = q.trim().toLowerCase()
    return state.sales.filter((x) => x.date >= a && x.date < b && (!s || x.number.toLowerCase().includes(s) || x.lines.some((l) => (l.nameAr + l.nameEn).toLowerCase().includes(s))))
  }, [state.sales, q, range])
  const agg = aggregate(list)

  return (
    <div>
      <PageHeader title={t('سجل المبيعات', 'Sales History')} subtitle={t('كل الفواتير المحفوظة مع تكلفتها وربحها', 'Every saved invoice with its cost and profit')}
        actions={<Button variant="primary" icon={<ScanLine size={16} />} onClick={() => nav.go({ name: 'pos' })}>{t('بيع جديد', 'New sale')}</Button>} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-80"><Search size={16} className="absolute start-3 top-3 text-muted" /><input className={inputCls + ' ps-9'} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('رقم الفاتورة أو المنتج', 'Invoice number or product')} /></div>
        <Segmented value={range} onChange={setRange} options={[{ value: 'today', label: t('اليوم', 'Today') }, { value: '7', label: t('٧ أيام', '7 days') }, { value: '30', label: t('٣٠ يوم', '30 days') }, { value: 'all', label: t('الكل', 'All') }]} />
        <div className="ms-auto flex gap-6 text-sm">
          <span className="text-muted">{t('فواتير', 'Invoices')} <b className="num text-olive">{agg.count}</b></span>
          <span className="text-muted">{t('مبيعات', 'Sales')} <b className="num text-olive">{f.money(agg.revenue)}</b></span>
          <span className="text-muted">{t('مجمل الربح', 'Gross profit')} <b className="num text-forest">{f.money(agg.profit)}</b></span>
        </div>
      </div>
      <Card className="overflow-hidden">
        {list.length === 0 ? <Empty icon={<ReceiptText size={22} />} title={t('لا توجد فواتير', 'No invoices found')} body={t('غيّر الفترة أو كلمة البحث', 'Try a different period or search')} /> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-line bg-[#fcfaf6]"><tr>
                <th className={th}>{t('الفاتورة', 'Invoice')}</th><th className={th}>{t('التاريخ', 'Date')}</th><th className={th}>{t('البنود', 'Items')}</th>
                <th className={th + ' !text-end'}>{t('الإجمالي', 'Total')}</th><th className={th + ' !text-end'}>{t('التكلفة', 'Cost')}</th><th className={th + ' !text-end'}>{t('مجمل الربح', 'Gross profit')}</th><th className={th}>{t('الحالة', 'Status')}</th>
              </tr></thead>
              <tbody>
                {list.map((s) => (
                  <tr key={s.id} onClick={() => nav.openSale(s.id)} className="cursor-pointer border-b border-line last:border-0 hover:bg-[#fcfaf6]">
                    <td className={td + ' num font-medium text-forest'}>{s.number}</td>
                    <td className={td + ' num text-muted'}>{f.date(s.date)} · {f.time(s.date)}</td>
                    <td className={td + ' max-w-[280px] truncate'}>{s.lines.map((l) => (lang === 'ar' ? l.nameAr : l.nameEn)).join('، ')}</td>
                    <td className={td + ' num text-end font-semibold'}>{f.n2(s.total)}</td>
                    <td className={td + ' num text-end text-muted'}>{f.n2(s.cogs)}</td>
                    <td className={td + ' num text-end text-forest'}>{f.n2(s.total - s.cogs)}</td>
                    <td className={td}><span className="inline-flex items-center gap-1 text-xs text-[#2c6a4c]"><CheckCircle2 size={13} />{t('مكتملة', 'Completed')}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

export function ReceiptModal({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { state, t, lang } = useStore()
  const f = useFmt()
  const s = state.sales.find((x) => x.id === id)
  if (!s) return null
  const fresh = Date.now() - s.date < 15000
  const profit = s.total - s.cogs
  return (
    <Modal open onClose={onClose} width="max-w-[760px]" title={<span className="flex items-center gap-2">{fresh && <CheckCircle2 size={18} className="text-[#2c6a4c]" />}{fresh ? t('تم البيع بنجاح', 'Sale completed') : t('تفاصيل الفاتورة', 'Sale details')}</span>}
      subtitle={<span className="num">{s.number} · {f.date(s.date)} {f.time(s.date)}</span>}
      footer={<><Button variant="ghost" onClick={onClose}>{t('إغلاق', 'Close')}</Button><Button variant="primary" icon={<Printer size={16} />} onClick={() => window.print()}>{t('طباعة الإيصال', 'Print receipt')}</Button></>}>
      <div className="grid gap-6 md:grid-cols-[1fr_230px]">
        <div className="print-area rounded-xl border border-dashed border-[#d6cdbd] bg-[#fffdf8] p-6">
          <div className="flex flex-col items-center text-center">
            <Logo compact />
            <p className="mt-2 font-semibold text-forest">{state.settings.storeName}</p>
            <p className="num text-xs text-muted">{state.settings.address} · {state.settings.phone}</p>
          </div>
          <div className="num my-4 flex justify-between border-y border-dashed border-[#d6cdbd] py-2 text-xs text-muted"><span>{s.number}</span><span>{f.date(s.date)} {f.time(s.date)}</span></div>
          <div className="space-y-2.5">
            {s.lines.map((l, i) => (
              <div key={i} className="flex justify-between gap-3 text-sm">
                <div>
                  <p>{lang === 'ar' ? l.nameAr : l.nameEn}</p>
                  <p className="num text-xs text-muted">{l.mode === 'weight' ? `${f.qty('weight', l.qty)} × ${f.n2(l.unitPrice)}` : l.mode === 'pack' ? `${l.count} × ${t('عبوة', 'pack')} ${f.qty('weight', l.packGrams!)} @ ${f.n2(l.unitPrice)}` : `${l.count} × ${f.n2(l.unitPrice)}`}</p>
                </div>
                <p className="num font-medium">{f.n2(l.total)}</p>
              </div>
            ))}
          </div>
          <div className="num mt-4 space-y-1 border-t border-dashed border-[#d6cdbd] pt-3 text-sm">
            <div className="flex justify-between text-base font-semibold text-forest"><span>{t('الإجمالي', 'Total')}</span><span>{f.money(s.total)}</span></div>
            <div className="flex justify-between text-muted"><span>{t('نقداً', 'Cash')}</span><span>{f.money(s.cash)}</span></div>
            <div className="flex justify-between text-muted"><span>{t('الباقي', 'Change')}</span><span>{f.money(s.change)}</span></div>
          </div>
          <p className="mt-5 text-center text-xs text-muted">{state.settings.receiptFooter}</p>
        </div>
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">{t('للإدارة فقط', 'Internal only')}</p>
          {[[t('المبيعات', 'Sales'), f.money(s.total)], [t('تكلفة البضاعة (لحظة البيع)', 'COGS (snapshot)'), f.money(s.cogs)], [t('مجمل الربح', 'Gross profit'), f.money(profit)], [t('الهامش', 'Margin'), f.pct((profit / s.total) * 100)]].map(([k, v], i) => (
            <div key={k} className={'rounded-xl px-4 py-3 ' + (i === 2 ? 'bg-forest text-ivory' : 'bg-[#f6f2ea]')}>
              <p className={'text-xs ' + (i === 2 ? 'text-ivory/60' : 'text-muted')}>{k}</p>
              <p className="num mt-0.5 font-semibold">{v}</p>
            </div>
          ))}
          <p className="text-xs leading-relaxed text-muted">{t('التكلفة محفوظة بمتوسط التكلفة المرجّح وقت البيع ولا تتغير مع الاستلامات اللاحقة.', 'Cost is frozen at the weighted-average cost at sale time and is unaffected by later receipts.')}</p>
        </div>
      </div>
    </Modal>
  )
}
