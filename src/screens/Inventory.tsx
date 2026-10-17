import { useMemo, useState } from 'react'
import { PackagePlus, SlidersHorizontal, Search, ArrowLeftRight, TrendingUp, TrendingDown } from 'lucide-react'
import { useStore, useFmt, stockStatus, round2, type MoveType } from '../store'
import { useNav } from '../nav'
import { Button, Card, Field, Modal, PageHeader, Segmented, Empty, StockBadge, ProductMark, Badge, useToast, inputCls, th, td, cx } from '../ui'

export function MoveTypeBadge({ type }: { type: MoveType }) {
  const { t } = useStore()
  const m = { opening: ['neutral', t('افتتاحي', 'Opening')], receive: ['green', t('استلام', 'Receipt')], sale: ['forest', t('بيع', 'Sale')], adjust: ['amber', t('تسوية', 'Adjustment')] } as const
  return <Badge tone={m[type][0]}>{m[type][1]}</Badge>
}

export function InventoryOverview() {
  const { state, t, pname } = useStore()
  const f = useFmt()
  const nav = useNav()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const list = state.products.filter((p) => (status === 'all' || stockStatus(p) === status) && (!q || (p.nameAr + p.nameEn + p.sku).toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => ({ out: 0, low: 1, ok: 2 })[stockStatus(a)] - ({ out: 0, low: 1, ok: 2 })[stockStatus(b)])
  const value = state.products.reduce((a, p) => a + (p.unit === 'weight' ? p.stock / 1000 : p.stock) * p.avgCost, 0)
  const retail = state.products.reduce((a, p) => a + (p.unit === 'weight' ? p.stock / 1000 : p.stock) * p.price, 0)
  const low = state.products.filter((p) => stockStatus(p) === 'low').length
  const out = state.products.filter((p) => stockStatus(p) === 'out').length

  return (
    <div>
      <PageHeader title={t('المخزون', 'Inventory')} subtitle={t('الأرصدة الحالية بمتوسط التكلفة المرجّح', 'Current balances at moving weighted-average cost')}
        actions={<><Button icon={<SlidersHorizontal size={16} />} onClick={() => nav.openStock('adjust')}>{t('تسوية مخزون', 'Adjust stock')}</Button><Button variant="primary" icon={<PackagePlus size={16} />} onClick={() => nav.openStock('receive')}>{t('استلام بضاعة', 'Receive stock')}</Button></>} />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[[t('قيمة المخزون بالتكلفة', 'Stock value at cost'), f.money(value), ''], [t('القيمة بسعر البيع', 'Value at retail'), f.money(retail), t(`ربح محتمل ${f.money(retail - value)}`, `Potential GP ${f.money(retail - value)}`)], [t('رصيد منخفض', 'Low stock'), String(low), 'low'], [t('نفد من المخزون', 'Out of stock'), String(out), 'out']].map(([k, v, s]) => (
          <button key={k} onClick={() => (s === 'low' || s === 'out') && setStatus(status === s ? 'all' : s)} className={cx('rounded-2xl border bg-white p-5 text-start transition', (s === 'low' || s === 'out') && 'cursor-pointer hover:border-forest/30', status === s ? 'border-forest ring-2 ring-forest/10' : 'border-line')}>
            <p className="text-xs text-muted">{k}</p>
            <p className={cx('num mt-1 text-2xl font-semibold', s === 'out' && v !== '0' ? 'text-[#a63d2f]' : s === 'low' && v !== '0' ? 'text-[#8a5a1c]' : 'text-forest')}>{v}</p>
            {s && s !== 'low' && s !== 'out' && <p className="num mt-0.5 text-xs text-muted">{s}</p>}
          </button>
        ))}
      </div>
      <div className="mb-4 flex items-center gap-3">
        <div className="relative w-72"><Search size={16} className="absolute start-3 top-3 text-muted" /><input className={inputCls + ' ps-9'} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('بحث في المخزون', 'Search inventory')} /></div>
        <Segmented value={status} onChange={setStatus} options={[{ value: 'all', label: t('الكل', 'All') }, { value: 'ok', label: t('متوفر', 'In stock') }, { value: 'low', label: t('منخفض', 'Low') }, { value: 'out', label: t('نفد', 'Out') }]} />
      </div>
      <Card className="overflow-hidden">
        {list.length === 0 ? <Empty title={t('لا توجد نتائج', 'No matching items')} /> : (
          <table className="w-full">
            <thead className="border-b border-line bg-[#fcfaf6]"><tr>
              <th className={th}>{t('المنتج', 'Product')}</th><th className={th}>{t('مستوى الرصيد', 'Level')}</th><th className={th + ' !text-end'}>{t('الرصيد', 'On hand')}</th>
              <th className={th + ' !text-end'}>{t('متوسط التكلفة', 'Avg. cost')}</th><th className={th + ' !text-end'}>{t('القيمة', 'Value')}</th><th className={th}>{t('الحالة', 'Status')}</th><th className={th} />
            </tr></thead>
            <tbody>
              {list.map((p) => {
                const st = stockStatus(p)
                return (
                  <tr key={p.id} className="border-b border-line last:border-0 hover:bg-[#fcfaf6]">
                    <td className={td}><button onClick={() => nav.go({ name: 'product', id: p.id })} className="flex items-center gap-3 text-start cursor-pointer"><ProductMark p={p} size={34} /><div><p className="font-medium hover:underline">{pname(p)}</p><p className="num text-xs text-muted">{p.sku}</p></div></button></td>
                    <td className={td + ' w-48'}>
                      <div className="relative h-1.5 w-36 rounded-full bg-[#f1ede4]">
                        <div className={cx('h-full rounded-full', st === 'ok' ? 'bg-forest' : st === 'low' ? 'bg-amber' : '')} style={{ width: `${Math.min(100, (p.stock / Math.max(p.lowStock * 3, 1)) * 100)}%` }} />
                        <span className="absolute -top-1 h-3.5 w-px bg-olive/40" style={{ insetInlineStart: '33.3%' }} title={t('حد التنبيه', 'Threshold')} />
                      </div>
                    </td>
                    <td className={td + ' num text-end font-medium'}>{f.qty(p.unit, p.stock)}</td>
                    <td className={td + ' num text-end text-muted'}>{f.n2(p.avgCost)} <span className="text-xs">{f.per(p.unit)}</span></td>
                    <td className={td + ' num text-end'}>{f.n2((p.unit === 'weight' ? p.stock / 1000 : p.stock) * p.avgCost)}</td>
                    <td className={td}><StockBadge p={p} /></td>
                    <td className={td + ' text-end'}>
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="ghost" onClick={() => nav.openStock('adjust', p.id)}>{t('تسوية', 'Adjust')}</Button>
                        <Button size="sm" icon={<PackagePlus size={14} />} onClick={() => nav.openStock('receive', p.id)}>{t('استلام', 'Receive')}</Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}

export function StockDialog({ open, mode: initialMode, productId, onClose }: { open: boolean; mode: 'receive' | 'adjust'; productId?: string; onClose: () => void }) {
  const { state, t, pname, receive, adjust } = useStore()
  const f = useFmt()
  const toast = useToast()
  const [mode, setMode] = useState(initialMode)
  const [pid, setPid] = useState(productId ?? '')
  const [qty, setQty] = useState('')
  const [cost, setCost] = useState('')
  const [dir, setDir] = useState<'in' | 'out'>('out')
  const [reason, setReason] = useState('damage')
  const [note, setNote] = useState('')
  const [tried, setTried] = useState(false)
  const p = state.products.find((x) => x.id === pid)
  const k = p?.unit === 'weight' ? 1000 : 1
  const u = p?.unit === 'weight' ? t('كجم', 'kg') : t('قطعة', 'pcs')
  const qn = parseFloat(qty) || 0
  const base = Math.round(qn * k)
  const cn = parseFloat(cost) || 0
  const reasons: Record<string, string> = { damage: t('تالف', 'Damaged'), expired: t('منتهي الصلاحية', 'Expired'), count: t('تصحيح جرد', 'Stock count correction'), sample: t('عينات وتذوق', 'Samples & tasting'), other: t('سبب آخر', 'Other') }

  const errors: Record<string, string> = {}
  if (!p) errors.p = t('اختر منتجاً', 'Select a product')
  if (!(qn > 0)) errors.qty = t('أدخل كمية أكبر من صفر', 'Enter a quantity above zero')
  else if (p?.unit === 'piece' && !Number.isInteger(qn)) errors.qty = t('القطع يجب أن تكون عدداً صحيحاً', 'Pieces must be a whole number')
  else if (mode === 'adjust' && dir === 'out' && p && base > p.stock) errors.qty = t(`لا يمكن أن يصبح الرصيد سالباً (المتاح ${f.qty(p.unit, p.stock)})`, `Stock cannot go negative (on hand ${f.qty(p.unit, p.stock)})`)
  if (mode === 'receive' && !(cn > 0)) errors.cost = t('أدخل تكلفة الشراء', 'Enter the acquisition cost')
  if (mode === 'adjust' && reason === 'other' && !note.trim()) errors.note = t('اكتب السبب', 'Describe the reason')
  const ok = Object.keys(errors).length === 0

  const newAvg = p && mode === 'receive' && qn > 0 && cn > 0 ? round2(((Math.max(p.stock, 0) / k) * p.avgCost + qn * cn) / (Math.max(p.stock, 0) / k + qn)) : null

  const submit = async () => {
    setTried(true)
    if (!ok || !p) return
    try {
      if (mode === 'receive') { await receive(p.id, base, cn, note.trim() || t('استلام بضاعة', 'Stock received')); toast(t(`تم استلام ${f.qty(p.unit, base)} من ${p.nameAr}`, `Received ${f.qty(p.unit, base)} of ${p.nameEn}`)) }
      else { await adjust(p.id, dir === 'in' ? base : -base, reasons[reason] + (note.trim() ? ` — ${note.trim()}` : '')); toast(t('تم تسجيل التسوية', 'Adjustment recorded')) }
    } catch { toast(t('تعذر حفظ حركة المخزون', 'Could not save the stock movement'), 'error'); return }
    onClose()
  }
  const E = (key: string) => (tried ? errors[key] : undefined)

  return (
    <Modal open={open} onClose={onClose} width="max-w-xl" title={mode === 'receive' ? t('استلام بضاعة', 'Receive stock') : t('تسوية المخزون', 'Stock adjustment')}
      subtitle={mode === 'receive' ? t('يُحدّث الرصيد ومتوسط التكلفة المرجّح', 'Updates balance and weighted-average cost') : t('تصحيح الرصيد مع تسجيل السبب', 'Correct the balance with a recorded reason')}
      footer={<><Button variant="ghost" onClick={onClose}>{t('إلغاء', 'Cancel')}</Button><Button variant="primary" onClick={submit}>{mode === 'receive' ? t('تأكيد الاستلام', 'Confirm receipt') : t('تسجيل التسوية', 'Record adjustment')}</Button></>}>
      <div className="space-y-4">
        <Segmented value={mode} onChange={(m) => { setMode(m); setTried(false) }} options={[{ value: 'receive', label: t('استلام', 'Receive') }, { value: 'adjust', label: t('تسوية', 'Adjust') }]} />
        <Field label={t('المنتج', 'Product')} error={E('p')}>
          <select className={inputCls} value={pid} onChange={(e) => setPid(e.target.value)}>
            <option value="">{t('اختر منتجاً…', 'Choose a product…')}</option>
            {state.products.map((x) => <option key={x.id} value={x.id}>{pname(x)} — {f.qty(x.unit, x.stock)}</option>)}
          </select>
        </Field>
        {p && <div className="num flex gap-6 rounded-xl bg-[#f6f2ea] px-4 py-3 text-sm"><span className="text-muted">{t('الرصيد', 'On hand')} <b className="text-olive">{f.qty(p.unit, p.stock)}</b></span><span className="text-muted">{t('متوسط التكلفة', 'Avg. cost')} <b className="text-olive">{f.money(p.avgCost)} {f.per(p.unit)}</b></span></div>}
        {mode === 'adjust' && (
          <div className="grid grid-cols-2 gap-3">
            {(['out', 'in'] as const).map((d) => (
              <button key={d} type="button" onClick={() => setDir(d)} className={cx('flex items-center gap-2 rounded-xl border px-4 py-3 text-sm transition cursor-pointer', dir === d ? 'border-forest bg-forest/[.04] ring-2 ring-forest/15' : 'border-line')}>
                {d === 'out' ? <TrendingDown size={16} className="text-[#a63d2f]" /> : <TrendingUp size={16} className="text-[#2c6a4c]" />}{d === 'out' ? t('خصم من الرصيد', 'Decrease stock') : t('إضافة للرصيد', 'Increase stock')}
              </button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Field label={`${t('الكمية', 'Quantity')}${p ? ` (${u})` : ''}`} error={E('qty')}><input type="number" min={0} step="any" className={inputCls + ' num'} value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
          {mode === 'receive' ? (
            <Field label={`${t('تكلفة الشراء', 'Acquisition cost')} (${t('ج.م', 'EGP')}${p ? ' / ' + u : ''})`} error={E('cost')}><input type="number" min={0} step="any" className={inputCls + ' num'} value={cost} onChange={(e) => setCost(e.target.value)} /></Field>
          ) : (
            <Field label={t('السبب', 'Reason')}><select className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)}>{Object.entries(reasons).map(([k2, l]) => <option key={k2} value={k2}>{l}</option>)}</select></Field>
          )}
        </div>
        <Field label={mode === 'receive' ? t('المورد / ملاحظة', 'Supplier / note') : t('ملاحظة', 'Note')} error={E('note')}><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder={mode === 'receive' ? t('مثال: الشركة المصرية للمكسرات', 'e.g. Egyptian Nuts Co.') : ''} /></Field>
        {p && newAvg !== null && (
          <div className="anim-up grid grid-cols-3 gap-px overflow-hidden rounded-xl bg-line text-sm">
            {[[t('إجمالي الفاتورة', 'Purchase total'), f.money(qn * cn)], [t('الرصيد الجديد', 'New balance'), f.qty(p.unit, p.stock + base)], [t('متوسط التكلفة الجديد', 'New avg. cost'), f.money(newAvg)]].map(([a, b]) => (
              <div key={a} className="bg-white px-4 py-3"><p className="text-xs text-muted">{a}</p><p className="num mt-0.5 font-semibold text-forest">{b}</p></div>
            ))}
          </div>
        )}
        {p && mode === 'adjust' && qn > 0 && !errors.qty && <p className="num text-sm text-muted">{t('الرصيد بعد التسوية', 'Balance after adjustment')}: <b className="text-olive">{f.qty(p.unit, p.stock + (dir === 'in' ? base : -base))}</b></p>}
      </div>
    </Modal>
  )
}

export function Movements({ initialProduct }: { initialProduct?: string }) {
  const { state, t, pname } = useStore()
  const f = useFmt()
  const nav = useNav()
  const [type, setType] = useState<'all' | MoveType>('all')
  const [pid, setPid] = useState(initialProduct ?? '')
  const [limit, setLimit] = useState(50)
  const list = useMemo(() => state.movements.filter((m) => (type === 'all' || m.type === type) && (!pid || m.productId === pid)).slice().reverse(), [state.movements, type, pid])

  return (
    <div>
      <PageHeader title={t('حركات المخزون', 'Stock Movements')} subtitle={t('سجل كامل لكل إضافة وخصم', 'A complete ledger of every in and out')}
        actions={<Button variant="primary" icon={<PackagePlus size={16} />} onClick={() => nav.openStock('receive', pid || undefined)}>{t('استلام بضاعة', 'Receive stock')}</Button>} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select className={inputCls + ' !w-64'} value={pid} onChange={(e) => setPid(e.target.value)}>
          <option value="">{t('كل المنتجات', 'All products')}</option>
          {state.products.map((p) => <option key={p.id} value={p.id}>{pname(p)}</option>)}
        </select>
        <Segmented value={type} onChange={setType} options={[{ value: 'all', label: t('الكل', 'All') }, { value: 'receive', label: t('استلام', 'Receipts') }, { value: 'sale', label: t('مبيعات', 'Sales') }, { value: 'adjust', label: t('تسويات', 'Adjustments') }, { value: 'opening', label: t('افتتاحي', 'Opening') }]} />
        <span className="num ms-auto text-sm text-muted">{list.length} {t('حركة', 'entries')}</span>
      </div>
      <Card className="overflow-hidden">
        {list.length === 0 ? <Empty icon={<ArrowLeftRight size={22} />} title={t('لا توجد حركات', 'No movements')} body={t('غيّر الفلاتر لعرض حركات أخرى', 'Change filters to see other entries')} /> : (
          <table className="w-full">
            <thead className="border-b border-line bg-[#fcfaf6]"><tr>
              <th className={th}>{t('التاريخ', 'Date')}</th><th className={th}>{t('النوع', 'Type')}</th><th className={th}>{t('المنتج', 'Product')}</th><th className={th}>{t('المرجع / السبب', 'Reference / reason')}</th>
              <th className={th + ' !text-end'}>{t('الكمية', 'Qty')}</th><th className={th + ' !text-end'}>{t('تكلفة الوحدة', 'Unit cost')}</th><th className={th + ' !text-end'}>{t('الرصيد بعد', 'Balance')}</th>
            </tr></thead>
            <tbody>
              {list.slice(0, limit).map((m) => {
                const p = state.products.find((x) => x.id === m.productId)
                if (!p) return null
                const sale = m.ref ? state.sales.find((s) => s.number === m.ref) : undefined
                return (
                  <tr key={m.id} className="border-b border-line last:border-0 hover:bg-[#fcfaf6]">
                    <td className={td + ' num text-muted'}>{f.date(m.date)} · {f.time(m.date)}</td>
                    <td className={td}><MoveTypeBadge type={m.type} /></td>
                    <td className={td}><button onClick={() => nav.go({ name: 'product', id: p.id })} className="font-medium hover:underline cursor-pointer">{pname(p)}</button></td>
                    <td className={td + ' max-w-[240px] truncate text-muted'}>{sale ? <button onClick={() => nav.openSale(sale.id)} className="num text-[#8a5a1c] hover:underline cursor-pointer">{m.ref}</button> : m.note ?? '—'}</td>
                    <td className={cx(td, 'num text-end font-medium', m.qty < 0 ? 'text-[#a63d2f]' : 'text-[#2c6a4c]')}>{m.qty > 0 ? '+' : '−'}{f.qty(p.unit, Math.abs(m.qty))}</td>
                    <td className={td + ' num text-end text-muted'}>{f.n2(m.unitCost)}</td>
                    <td className={td + ' num text-end'}>{f.qty(p.unit, m.balance)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        {list.length > limit && <div className="border-t border-line p-3 text-center"><Button variant="ghost" size="sm" onClick={() => setLimit(limit + 50)}>{t('عرض المزيد', 'Show more')}</Button></div>}
      </Card>
    </div>
  )
}
