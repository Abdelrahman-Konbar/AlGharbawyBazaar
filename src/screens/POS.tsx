import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, Minus, Plus, Trash2, Scale, ShoppingBag, Banknote, Loader2, X, Pencil, Package as PackIcon } from 'lucide-react'
import { useStore, useFmt, lineInfo, uid, CATEGORIES, stockStatus, round2, type CartLine, type Product } from '../store'
import { useNav } from '../nav'
import { Button, Modal, Segmented, ProductMark, Confirm, Empty, useToast, inputCls, cx } from '../ui'

export default function POS() {
  const { state, t, pname, checkout } = useStore()
  const f = useFmt()
  const nav = useNav()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('all')
  const [cart, setCart] = useState<CartLine[]>(() => { try { return JSON.parse(sessionStorage.getItem('gb-cart') || '[]') } catch { return [] } })
  const [cash, setCash] = useState('')
  const [weigh, setWeigh] = useState<{ product: Product; edit?: CartLine } | null>(null)
  const [clearAsk, setClearAsk] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const cashRef = useRef<HTMLInputElement>(null)

  useEffect(() => { sessionStorage.setItem('gb-cart', JSON.stringify(cart)) }, [cart])
  // drop lines for products that no longer exist
  const validCart = cart.filter((c) => state.products.some((p) => p.id === c.productId))

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return state.products.filter((p) => (cat === 'all' || p.category === cat) && (!s || (p.nameAr + ' ' + p.nameEn + ' ' + p.sku).toLowerCase().includes(s)))
  }, [state.products, q, cat])

  const inCart = (pid: string, exceptKey?: string) => validCart.filter((c) => c.productId === pid && c.key !== exceptKey).reduce((a, c) => a + lineInfo(state.products.find((p) => p.id === pid)!, c).base, 0)
  const avail = (p: Product, exceptKey?: string) => p.stock - inCart(p.id, exceptKey)

  const total = round2(validCart.reduce((a, c) => a + lineInfo(state.products.find((p) => p.id === c.productId)!, c).total, 0))
  const cashN = parseFloat(cash) || 0
  const change = cashN - total

  const add = (p: Product) => {
    setError('')
    if (p.unit === 'weight') return setWeigh({ product: p })
    if (avail(p) < 1) return toast(p.stock <= 0 ? t('المنتج نفد من المخزون', 'This product is out of stock') : t('لا يوجد رصيد كافٍ', 'Not enough stock'), 'error')
    setCart((c) => {
      const ex = c.find((x) => x.productId === p.id && x.mode === 'piece')
      return ex ? c.map((x) => (x === ex ? { ...x, qty: x.qty + 1 } : x)) : [...c, { key: uid(), productId: p.id, mode: 'piece', qty: 1 }]
    })
  }

  const step = (line: CartLine, d: number) => {
    const p = state.products.find((x) => x.id === line.productId)!
    const nq = line.qty + d
    if (nq < 1) return setCart((c) => c.filter((x) => x.key !== line.key))
    const per = line.mode === 'pack' ? p.packs.find((k) => k.id === line.packId)!.grams : 1
    if (d > 0 && avail(p, line.key) < nq * per) return toast(t(`المتاح فقط ${f.qty(p.unit, avail(p, line.key))}`, `Only ${f.qty(p.unit, avail(p, line.key))} available`), 'error')
    setCart((c) => c.map((x) => (x.key === line.key ? { ...x, qty: nq } : x)))
  }

  const confirm = () => {
    if (lock.current || !validCart.length) return
    if (cashN < total) { setError(t('المبلغ المستلم أقل من الإجمالي', 'Cash received is less than the total')); cashRef.current?.focus(); return }
    lock.current = true
    setBusy(true)
    setTimeout(() => {
      const r = checkout(validCart, cashN)
      if (r.ok) {
        setCart([]); setCash(''); setError('')
        toast(t(`تم تسجيل الفاتورة ${r.sale.number}`, `Invoice ${r.sale.number} saved`))
        nav.openSale(r.sale.id)
      } else setError(r.error)
      setBusy(false)
      lock.current = false
    }, 450)
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (weigh) return
      if (e.key === 'F9') { e.preventDefault(); confirm() }
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') { e.preventDefault(); searchRef.current?.focus() }
      if (e.key === 'F4') { e.preventDefault(); cashRef.current?.focus() }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  const quick = Array.from(new Set([Math.ceil(total), Math.ceil(total / 50) * 50, Math.ceil(total / 100) * 100, Math.ceil(total / 200) * 200, 500, 1000].filter((v) => v >= total && v > 0))).slice(0, 5)

  return (
    <div className="flex h-full">
      {/* Catalog */}
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-line px-7 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search size={18} className="absolute start-4 top-[15px] text-muted" />
              <input ref={searchRef} autoFocus value={q} onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && list[0]) { add(list[0]); } if (e.key === 'Escape') setQ('') }}
                placeholder={t('ابحث بالاسم أو الكود… (Enter لإضافة أول نتيجة)', 'Search name or SKU… (Enter adds first match)')}
                className="h-12 w-full rounded-xl border border-line bg-white ps-11 pe-4 text-[15px] outline-none focus:border-forest focus:ring-4 focus:ring-forest/10" />
            </div>
            <div className="hidden gap-1.5 text-[11px] text-muted xl:flex">
              {[['/', t('بحث', 'Search')], ['F4', t('النقدية', 'Cash')], ['F9', t('تأكيد', 'Confirm')]].map(([k, l]) => <span key={k} className="flex items-center gap-1"><kbd className="num rounded-md border border-line bg-white px-1.5 py-0.5 font-medium text-olive">{k}</kbd>{l}</span>)}
            </div>
          </div>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {[['all', t('الكل', 'All')] as const, ...Object.entries(CATEGORIES).map(([k, v]) => [k, t(v[0], v[1])] as const)].map(([k, l]) => (
              <button key={k} onClick={() => setCat(k)} className={cx('h-8 shrink-0 rounded-full border px-3.5 text-[13px] transition cursor-pointer', cat === k ? 'border-forest bg-forest text-ivory' : 'border-line bg-white text-olive/75 hover:border-[#d6cdbd]')}>{l}</button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-7 py-5">
          {list.length === 0 ? (
            <Empty icon={<Search size={22} />} title={t('لا توجد نتائج', 'No products found')} body={t('جرّب كلمة أخرى أو اختر تصنيفاً مختلفاً', 'Try another term or category')} action={<Button size="sm" onClick={() => { setQ(''); setCat('all') }}>{t('مسح البحث', 'Clear search')}</Button>} />
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(178px,1fr))] gap-3">
              {list.map((p, i) => {
                const st = stockStatus(p)
                const a = avail(p)
                return (
                  <button key={p.id} disabled={st === 'out'} onClick={() => add(p)}
                    className={cx('group relative flex flex-col rounded-2xl border bg-white p-4 text-start transition cursor-pointer', st === 'out' ? 'cursor-not-allowed opacity-50' : 'border-line hover:-translate-y-0.5 hover:border-forest/40 hover:shadow-[0_8px_24px_-12px_rgba(31,64,53,.35)]', i === 0 && q ? 'ring-2 ring-amber/60' : '', 'border-line')}>
                    <div className="flex items-start justify-between">
                      <ProductMark p={p} size={42} />
                      {p.unit === 'weight' ? <Scale size={15} className="text-muted" /> : <PackIcon size={15} className="text-muted" />}
                    </div>
                    <p className="mt-3 line-clamp-2 min-h-[40px] text-[14px] font-medium leading-snug">{pname(p)}</p>
                    <p className="num mt-1 text-[15px] font-semibold text-forest">{f.n2(p.price)} <span className="text-xs font-normal text-muted">{f.per(p.unit)}</span></p>
                    <div className="mt-2.5 flex items-center justify-between border-t border-dashed border-line pt-2.5 text-[11px]">
                      <span className={cx('num', st === 'out' ? 'text-[#a63d2f]' : st === 'low' ? 'text-[#8a5a1c]' : 'text-muted')}>{st === 'out' ? t('نفد', 'Out of stock') : f.qty(p.unit, a)}</span>
                      {p.packs.length > 0 && <span className="rounded bg-amber-soft px-1.5 text-[#8a5a1c]">{p.packs.length} {t('عبوات', 'packs')}</span>}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* Cart */}
      <aside className="flex w-[420px] shrink-0 flex-col border-s border-line bg-white">
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <div>
            <h2 className="text-lg font-semibold text-forest">{t('الفاتورة الحالية', 'Current sale')}</h2>
            <p className="num text-xs text-muted">INV-{state.seq + 1} · {validCart.length} {t('بنود', 'items')}</p>
          </div>
          {validCart.length > 0 && <Button variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={() => setClearAsk(true)}>{t('مسح', 'Clear')}</Button>}
        </div>
        <div className="flex-1 overflow-y-auto border-t border-line">
          {validCart.length === 0 ? (
            <Empty icon={<ShoppingBag size={22} />} title={t('الفاتورة فارغة', 'Cart is empty')} body={t('اختر منتجاً أو ابحث عنه لإضافته', 'Pick or search a product to begin')} />
          ) : validCart.map((c) => {
            const p = state.products.find((x) => x.id === c.productId)!
            const li = lineInfo(p, c)
            return (
              <div key={c.key} className="anim-up group border-b border-line px-6 py-3.5">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{pname(p)}</p>
                    <p className="num mt-0.5 text-xs text-muted">
                      {c.mode === 'weight' ? `${f.qty('weight', c.qty)} × ${f.n2(p.price)} ${f.per('weight')}` : c.mode === 'pack' ? `${t('عبوة', 'Pack')} ${f.qty('weight', li.packGrams!)} × ${f.n2(li.unitPrice)}` : `${f.n2(p.price)} ${f.per('piece')}`}
                    </p>
                  </div>
                  <p className="num text-sm font-semibold">{f.n2(li.total)}</p>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  {c.mode === 'weight' ? (
                    <button onClick={() => setWeigh({ product: p, edit: c })} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-xs text-olive/80 hover:border-forest/40 cursor-pointer"><Pencil size={12} />{t('تعديل الوزن', 'Edit weight')}</button>
                  ) : (
                    <div className="flex items-center rounded-lg border border-line">
                      <button onClick={() => step(c, -1)} className="grid size-8 place-items-center text-olive/70 hover:text-forest cursor-pointer"><Minus size={14} /></button>
                      <span className="num w-8 text-center text-sm font-medium">{c.qty}</span>
                      <button onClick={() => step(c, 1)} className="grid size-8 place-items-center text-olive/70 hover:text-forest cursor-pointer"><Plus size={14} /></button>
                    </div>
                  )}
                  <button onClick={() => setCart((x) => x.filter((y) => y.key !== c.key))} className="rounded-lg p-1.5 text-muted opacity-60 hover:bg-[#f8e3df] hover:text-[#a63d2f] group-hover:opacity-100 cursor-pointer" title={t('حذف', 'Remove')}><X size={15} /></button>
                </div>
              </div>
            )
          })}
        </div>

        <div className="border-t border-line bg-[#fcfaf6] px-6 pt-4 pb-5">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted">{t('الإجمالي', 'Total')}</span>
            <span className="num text-[30px] font-semibold tracking-tight text-forest">{f.n2(total)} <span className="text-sm font-normal text-muted">{t('ج.م', 'EGP')}</span></span>
          </div>
          <div className="mt-3">
            <div className="relative">
              <Banknote size={17} className="absolute start-3 top-3.5 text-muted" />
              <input ref={cashRef} type="number" min={0} inputMode="decimal" value={cash} disabled={!validCart.length}
                onChange={(e) => { setCash(e.target.value); setError('') }} onKeyDown={(e) => e.key === 'Enter' && confirm()}
                placeholder={t('المبلغ المستلم نقداً', 'Cash received')}
                className={cx(inputCls, 'num h-12 ps-10 text-base', error && '!border-[#a63d2f]')} />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {validCart.length > 0 && quick.map((v, i) => (
                <button key={v} onClick={() => { setCash(String(v)); setError('') }} className={cx('num h-7 rounded-md border px-2.5 text-xs transition cursor-pointer', cashN === v ? 'border-forest bg-forest text-ivory' : 'border-line bg-white hover:border-forest/40')}>{i === 0 ? t('مضبوط', 'Exact') + ' ' : ''}{v}</button>
              ))}
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between rounded-xl bg-white px-4 py-3 ring-1 ring-line">
            <span className="text-sm text-muted">{t('الباقي للعميل', 'Change due')}</span>
            <span className={cx('num text-lg font-semibold', cash && change < 0 ? 'text-[#a63d2f]' : 'text-[#8a5a1c]')}>{cash ? (change < 0 ? `− ${f.n2(-change)}` : f.n2(change)) : '—'}</span>
          </div>
          {error && <p className="anim-up mt-2 text-xs text-[#a63d2f]">{error}</p>}
          <Button variant="primary" size="lg" className="mt-3 w-full !h-14 text-base" disabled={!validCart.length || busy || !cash} onClick={confirm}>
            {busy ? <><Loader2 size={18} className="animate-spin" />{t('جارٍ الحفظ…', 'Saving…')}</> : <>{t('تأكيد البيع', 'Confirm sale')} <kbd className="num rounded border border-ivory/25 px-1.5 text-[11px] font-normal text-ivory/70">F9</kbd></>}
          </Button>
        </div>
      </aside>

      {weigh && <WeighDialog product={weigh.product} edit={weigh.edit} available={avail(weigh.product, weigh.edit?.key)} onClose={() => { setWeigh(null); searchRef.current?.focus() }}
        onAdd={(line) => {
          setCart((c) => {
            if (weigh.edit) return c.map((x) => (x.key === weigh.edit!.key ? { ...line, key: x.key } : x))
            const ex = line.mode === 'pack' && c.find((x) => x.productId === line.productId && x.mode === 'pack' && x.packId === line.packId)
            return ex ? c.map((x) => (x === ex ? { ...x, qty: x.qty + line.qty } : x)) : [...c, line]
          })
          setWeigh(null); setQ(''); searchRef.current?.focus()
        }} />}
      <Confirm open={clearAsk} onClose={() => setClearAsk(false)} title={t('مسح الفاتورة؟', 'Clear this sale?')} body={t('سيتم حذف كل البنود من الفاتورة الحالية.', 'All items in the current sale will be removed.')} confirmLabel={t('مسح الكل', 'Clear all')} danger onConfirm={() => { setCart([]); setCash('') }} />
    </div>
  )
}

function WeighDialog({ product: p, edit, available, onClose, onAdd }: { product: Product; edit?: CartLine; available: number; onClose: () => void; onAdd: (l: CartLine) => void }) {
  const { t, pname } = useStore()
  const f = useFmt()
  const [mode, setMode] = useState<'weight' | 'amount' | 'pack'>('weight')
  const [grams, setGrams] = useState(edit ? String(edit.qty) : '')
  const [amount, setAmount] = useState('')
  const [pack, setPack] = useState(p.packs[0]?.id ?? '')
  const [packs, setPacks] = useState(1)
  const g = mode === 'amount' ? Math.round(((parseFloat(amount) || 0) / p.price) * 1000) : Math.round(parseFloat(grams) || 0)
  const pk = p.packs.find((x) => x.id === pack)
  const need = mode === 'pack' ? (pk ? pk.grams * packs : 0) : g
  const price = mode === 'pack' ? (pk ? pk.price * packs : 0) : round2((g / 1000) * p.price)
  const err = need <= 0 ? '' : need > available ? t(`الكمية تتجاوز المتاح (${f.qty('weight', available)})`, `Exceeds available stock (${f.qty('weight', available)})`) : ''
  const ok = need > 0 && !err
  const submit = () => {
    if (!ok) return
    if (mode === 'pack') onAdd({ key: uid(), productId: p.id, mode: 'pack', packId: pack, qty: packs })
    else onAdd({ key: uid(), productId: p.id, mode: 'weight', qty: g })
  }
  return (
    <Modal open onClose={onClose} title={pname(p)} subtitle={<span className="num">{f.n2(p.price)} {t('ج.م', 'EGP')} {f.per('weight')} · {t('المتاح', 'Available')} {f.qty('weight', available)}</span>}
      footer={<><Button variant="ghost" onClick={onClose}>{t('إلغاء', 'Cancel')}</Button><Button variant="primary" disabled={!ok} onClick={submit}>{edit ? t('حفظ التعديل', 'Update line') : t('إضافة للفاتورة', 'Add to sale')} · <span className="num">{f.n2(price)}</span></Button></>}>
      {!edit && (
        <Segmented className="mb-5" value={mode} onChange={setMode} options={[
          { value: 'weight', label: t('بالوزن', 'By weight') },
          { value: 'amount', label: t('بالمبلغ', 'By amount') },
          ...(p.packs.length ? [{ value: 'pack' as const, label: t('عبوات جاهزة', 'Packs') }] : []),
        ]} />
      )}
      <form onSubmit={(e) => { e.preventDefault(); submit() }}>
        {mode === 'weight' && (
          <>
            <div className="relative">
              <input autoFocus type="number" min={1} step={1} value={grams} onChange={(e) => setGrams(e.target.value)} placeholder="0"
                className={cx(inputCls, 'num !h-16 pe-16 !text-3xl font-semibold', err && '!border-[#a63d2f]')} />
              <span className="absolute end-4 top-5 text-muted">{t('جرام', 'grams')}</span>
            </div>
            <div className="mt-3 grid grid-cols-5 gap-2">
              {[125, 250, 500, 750, 1000].map((v) => (
                <button type="button" key={v} onClick={() => setGrams(String(v))} className={cx('num h-10 rounded-lg border text-sm transition cursor-pointer', g === v ? 'border-forest bg-forest text-ivory' : 'border-line hover:border-forest/40')}>{v >= 1000 ? `${v / 1000} ${t('كجم', 'kg')}` : `${v}${t('جم', 'g')}`}</button>
              ))}
            </div>
          </>
        )}
        {mode === 'amount' && (
          <>
            <div className="relative">
              <input autoFocus type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0"
                className={cx(inputCls, 'num !h-16 pe-16 !text-3xl font-semibold', err && '!border-[#a63d2f]')} />
              <span className="absolute end-4 top-5 text-muted">{t('ج.م', 'EGP')}</span>
            </div>
            <p className="num mt-3 text-sm text-muted">= {f.qty('weight', g)}</p>
          </>
        )}
        {mode === 'pack' && (
          <div className="space-y-2">
            {p.packs.map((x) => (
              <button type="button" key={x.id} onClick={() => setPack(x.id)} className={cx('flex w-full items-center justify-between rounded-xl border px-4 py-3 text-start transition cursor-pointer', pack === x.id ? 'border-forest bg-forest/[.04] ring-2 ring-forest/15' : 'border-line hover:border-forest/30')}>
                <span className="num font-medium">{f.qty('weight', x.grams)}</span>
                <span className="num text-sm text-forest">{f.money(x.price)}</span>
              </button>
            ))}
            <div className="flex items-center justify-between pt-3">
              <span className="text-sm text-muted">{t('عدد العبوات', 'Number of packs')}</span>
              <div className="flex items-center rounded-lg border border-line">
                <button type="button" onClick={() => setPacks(Math.max(1, packs - 1))} className="grid size-9 place-items-center cursor-pointer"><Minus size={14} /></button>
                <span className="num w-10 text-center font-medium">{packs}</span>
                <button type="button" onClick={() => setPacks(packs + 1)} className="grid size-9 place-items-center cursor-pointer"><Plus size={14} /></button>
              </div>
            </div>
            <p className="text-xs text-muted">{t('العبوات تُخصم من رصيد المنتج السائب.', 'Packs are drawn from the shared bulk stock.')}</p>
          </div>
        )}
        {err && <p className="anim-up mt-3 rounded-lg bg-[#fbeeeb] px-3 py-2 text-sm text-[#a63d2f]">{err}</p>}
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  )
}
