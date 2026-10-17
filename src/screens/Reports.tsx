import { useEffect, useMemo, useState } from 'react'
import { Info, Calendar } from 'lucide-react'
import { useStore, useFmt, CATEGORIES } from '../store'
import { useNav } from '../nav'
import { Card, PageHeader, Segmented, Empty, ProductMark, inputCls, th, td } from '../ui'
import { aggregate, Bars, dayStart } from './Dashboard'
import { rangeFilter } from './Sales'

export default function Reports() {
  const { state, t, pname, lang } = useStore()
  const f = useFmt()
  const nav = useNav()
  const [range, setRange] = useState('30')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [loading, setLoading] = useState(false)
  useEffect(() => { setLoading(true); const h = setTimeout(() => setLoading(false), 350); return () => clearTimeout(h) }, [range, from, to])
  const rangeErr = range === 'custom' && from && to && from > to
  const [a, b] = rangeFilter(range, from, to)
  const sales = useMemo(() => (rangeErr ? [] : state.sales.filter((s) => s.date >= a && s.date < b)), [state.sales, a, b, rangeErr])
  const agg = aggregate(sales)

  const D = 86400000
  const start = sales.length ? dayStart(Math.min(...sales.map((s) => s.date))) : dayStart(Date.now())
  const end = Math.min(b === Infinity ? Date.now() : b - 1, Date.now())
  const nDays = Math.min(60, Math.max(1, Math.round((dayStart(end) - start) / D) + 1))
  const days = Array.from({ length: nDays }, (_, i) => {
    const s = dayStart(end) - (nDays - 1 - i) * D
    const x = aggregate(sales.filter((y) => y.date >= s && y.date < s + D))
    return { label: new Date(s).toLocaleDateString(lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'short' }), a: x.revenue, b: x.profit }
  })

  const byProduct: Record<string, { id: string; unit: any; qty: number; rev: number; cost: number; name: [string, string] }> = {}
  const byCat: Record<string, { rev: number; cost: number }> = {}
  sales.forEach((s) => s.lines.forEach((l) => {
    const x = (byProduct[l.productId] ??= { id: l.productId, unit: l.unit, qty: 0, rev: 0, cost: 0, name: [l.nameAr, l.nameEn] })
    x.qty += l.qty; x.rev += l.total; x.cost += l.cost
    const cat = state.products.find((p) => p.id === l.productId)?.category ?? 'nuts'
    const c = (byCat[cat] ??= { rev: 0, cost: 0 }); c.rev += l.total; c.cost += l.cost
  }))
  const best = Object.values(byProduct).sort((x, y) => y.rev - x.rev)

  return (
    <div>
      <PageHeader title={t('الأرباح والتقارير', 'Profits & Reports')} subtitle={t('أرقام محسوبة من الفواتير الفعلية وتكلفتها المحفوظة', 'Calculated from actual invoices and their saved cost snapshots')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Segmented value={range} onChange={setRange} options={[{ value: 'today', label: t('اليوم', 'Today') }, { value: '7', label: t('٧ أيام', '7 days') }, { value: '30', label: t('٣٠ يوم', '30 days') }, { value: 'all', label: t('الكل', 'All time') }, { value: 'custom', label: <span className="inline-flex items-center gap-1"><Calendar size={13} />{t('مخصص', 'Custom')}</span> }]} />
            {range === 'custom' && <>
              <input type="date" className={inputCls + ' num !h-9 !w-40'} value={from} onChange={(e) => setFrom(e.target.value)} />
              <span className="text-muted">—</span>
              <input type="date" className={inputCls + ' num !h-9 !w-40'} value={to} onChange={(e) => setTo(e.target.value)} />
            </>}
          </div>
        } />
      {rangeErr && <p className="mb-4 rounded-xl bg-[#fbeeeb] px-4 py-3 text-sm text-[#a63d2f]">{t('تاريخ البداية بعد تاريخ النهاية', 'Start date is after end date')}</p>}

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        {[[t('صافي المبيعات', 'Sales revenue'), f.money(agg.revenue)], [t('تكلفة البضاعة المباعة', 'Cost of goods sold'), f.money(agg.cogs)], [t('مجمل الربح', 'Gross profit'), f.money(agg.profit)], [t('هامش مجمل الربح', 'Gross margin'), f.pct(agg.margin)], [t('عدد الفواتير', 'Invoices'), String(agg.count)]].map(([k, v], i) => (
          <div key={k} className={'rounded-2xl p-5 ' + (i === 2 ? 'bg-forest text-ivory' : 'border border-line bg-white')}>
            <p className={'text-xs ' + (i === 2 ? 'text-ivory/60' : 'text-muted')}>{k}</p>
            {loading ? <div className="skeleton mt-2 h-7 w-3/4" /> : <p className={'num mt-1 text-[22px] font-semibold ' + (i === 2 ? '' : 'text-forest')}>{v}</p>}
          </div>
        ))}
      </div>

      {sales.length === 0 && !loading ? <Card><Empty title={t('لا توجد مبيعات في هذه الفترة', 'No sales in this period')} body={t('اختر فترة أخرى', 'Choose another date range')} /></Card> : (
        <>
          <div className="mb-6 grid gap-6 lg:grid-cols-[1.7fr_1fr]">
            <Card className="p-6">
              <h3 className="mb-1 font-semibold text-forest">{t('المبيعات ومجمل الربح', 'Sales vs. gross profit')}</h3>
              <p className="mb-6 text-[13px] text-muted">{t('الجزء الداكن من كل عمود هو الربح', 'The dark portion of each bar is gross profit')}</p>
              {loading ? <div className="skeleton h-[200px]" /> : <Bars data={days} height={200} labels={[t('المبيعات', 'Sales'), t('الربح', 'Profit')]} />}
            </Card>
            <Card className="p-6">
              <h3 className="mb-4 font-semibold text-forest">{t('حسب التصنيف', 'By category')}</h3>
              <div className="space-y-3.5">
                {Object.entries(byCat).sort((x, y) => y[1].rev - x[1].rev).map(([k, v]) => (
                  <div key={k}>
                    <div className="flex justify-between text-sm"><span>{t(...CATEGORIES[k])}</span><span className="num font-medium">{f.money(v.rev)}</span></div>
                    <div className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-[#f1ede4]">
                      <div className="bg-forest" style={{ width: `${((v.rev - v.cost) / agg.revenue) * 100}%` }} />
                      <div className="bg-amber/60" style={{ width: `${(v.cost / agg.revenue) * 100}%` }} />
                    </div>
                    <p className="num mt-1 text-[11px] text-muted">{t('هامش', 'Margin')} {f.pct(((v.rev - v.cost) / v.rev) * 100)}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
          <Card className="overflow-hidden">
            <div className="px-6 pt-5 pb-3"><h3 className="font-semibold text-forest">{t('الأكثر مبيعاً', 'Best-selling products')}</h3></div>
            <table className="w-full">
              <thead className="border-y border-line bg-[#fcfaf6]"><tr>
                <th className={th}>#</th><th className={th}>{t('المنتج', 'Product')}</th><th className={th + ' !text-end'}>{t('الكمية', 'Qty sold')}</th><th className={th + ' !text-end'}>{t('المبيعات', 'Revenue')}</th>
                <th className={th + ' !text-end'}>{t('التكلفة', 'COGS')}</th><th className={th + ' !text-end'}>{t('مجمل الربح', 'Gross profit')}</th><th className={th + ' !text-end'}>{t('الهامش', 'Margin')}</th><th className={th}>{t('الحصة', 'Share')}</th>
              </tr></thead>
              <tbody>
                {best.map((x, i) => {
                  const p = state.products.find((y) => y.id === x.id)
                  return (
                    <tr key={x.id} className="border-b border-line last:border-0 hover:bg-[#fcfaf6]">
                      <td className={td + ' num text-muted'}>{i + 1}</td>
                      <td className={td}><button disabled={!p} onClick={() => p && nav.go({ name: 'product', id: p.id })} className="flex items-center gap-3 text-start cursor-pointer">{p && <ProductMark p={p} size={30} />}<span className="font-medium">{p ? pname(p) : lang === 'ar' ? x.name[0] : x.name[1]}</span></button></td>
                      <td className={td + ' num text-end'}>{f.qty(x.unit, x.qty)}</td>
                      <td className={td + ' num text-end font-medium'}>{f.n2(x.rev)}</td>
                      <td className={td + ' num text-end text-muted'}>{f.n2(x.cost)}</td>
                      <td className={td + ' num text-end text-forest'}>{f.n2(x.rev - x.cost)}</td>
                      <td className={td + ' num text-end'}>{f.pct(((x.rev - x.cost) / x.rev) * 100)}</td>
                      <td className={td + ' w-32'}><div className="h-1.5 w-24 rounded-full bg-[#f1ede4]"><div className="h-full rounded-full bg-amber" style={{ width: `${(x.rev / best[0].rev) * 100}%` }} /></div></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Card>
        </>
      )}
      <p className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-muted"><Info size={14} className="mt-0.5 shrink-0" />{t('يعرض النظام مجمل الربح فقط (المبيعات ناقص تكلفة البضاعة المباعة). صافي الربح غير محسوب لأن المصروفات التشغيلية مثل الإيجار والرواتب لا تُسجّل في النظام.', 'Only gross profit is shown (revenue minus cost of goods sold). Net profit is not calculated because operating expenses such as rent and salaries are not tracked in this system.')}</p>
    </div>
  )
}
