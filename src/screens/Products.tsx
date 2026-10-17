import { useEffect, useMemo, useState } from 'react'
import { Plus, Search, Pencil, Trash2, PackagePlus, SlidersHorizontal, ArrowRight, Scale, Package as PackIcon, X } from 'lucide-react'
import { useStore, useFmt, CATEGORIES, stockStatus, uid, type Product, type Unit, type Pack } from '../store'
import { useNav } from '../nav'
import { Button, Card, Drawer, Field, PageHeader, Segmented, Empty, StockBadge, ProductMark, Confirm, Badge, useToast, inputCls, th, td, cx } from '../ui'
import { MoveTypeBadge } from './Inventory'

export function ProductsCatalog({ initialQ }: { initialQ?: string }) {
  const { state, t, pname } = useStore()
  const f = useFmt()
  const nav = useNav()
  const [q, setQ] = useState(initialQ ?? '')
  const [cat, setCat] = useState('all')
  const [unit, setUnit] = useState<'all' | Unit>('all')
  const [status, setStatus] = useState('all')
  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return state.products.filter((p) => (cat === 'all' || p.category === cat) && (unit === 'all' || p.unit === unit) && (status === 'all' || stockStatus(p) === status) && (!s || (p.nameAr + p.nameEn + p.sku).toLowerCase().includes(s)))
  }, [state.products, q, cat, unit, status])
  const filtered = q || cat !== 'all' || unit !== 'all' || status !== 'all'

  return (
    <div>
      <PageHeader title={t('المنتجات', 'Products')} subtitle={<span className="num">{state.products.length} {t('منتج في الكتالوج', 'products in catalog')}</span>}
        actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => nav.openProductForm()}>{t('منتج جديد', 'New product')}</Button>} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-72"><Search size={16} className="absolute start-3 top-3 text-muted" /><input className={inputCls + ' ps-9'} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('بحث بالاسم أو الكود', 'Search name or SKU')} /></div>
        <select className={inputCls + ' !w-48'} value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="all">{t('كل التصنيفات', 'All categories')}</option>
          {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{t(v[0], v[1])}</option>)}
        </select>
        <Segmented value={unit} onChange={setUnit} options={[{ value: 'all', label: t('الكل', 'All') }, { value: 'weight', label: t('بالوزن', 'By weight') }, { value: 'piece', label: t('بالقطعة', 'By piece') }]} />
        <Segmented value={status} onChange={setStatus} options={[{ value: 'all', label: t('كل الحالات', 'Any stock') }, { value: 'low', label: t('منخفض', 'Low') }, { value: 'out', label: t('نفد', 'Out') }]} />
        {filtered && <Button variant="ghost" size="sm" icon={<X size={14} />} onClick={() => { setQ(''); setCat('all'); setUnit('all'); setStatus('all') }}>{t('مسح الفلاتر', 'Clear filters')}</Button>}
      </div>
      <Card className="overflow-hidden">
        {list.length === 0 ? (
          <Empty icon={<Search size={22} />} title={state.products.length ? t('لا توجد نتائج', 'No matching products') : t('لا توجد منتجات بعد', 'No products yet')}
            body={state.products.length ? t('جرّب تعديل البحث أو الفلاتر', 'Adjust your search or filters') : t('أضف أول منتج لبدء البيع', 'Add your first product to start selling')}
            action={<Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => nav.openProductForm()}>{t('منتج جديد', 'New product')}</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-line bg-[#fcfaf6]"><tr>
                <th className={th}>{t('المنتج', 'Product')}</th><th className={th}>{t('التصنيف', 'Category')}</th><th className={th}>{t('نوع البيع', 'Sold by')}</th>
                <th className={th + ' !text-end'}>{t('سعر البيع', 'Price')}</th><th className={th + ' !text-end'}>{t('متوسط التكلفة', 'Avg. cost')}</th><th className={th + ' !text-end'}>{t('الهامش', 'Margin')}</th>
                <th className={th + ' !text-end'}>{t('الرصيد', 'Stock')}</th><th className={th}>{t('الحالة', 'Status')}</th>
              </tr></thead>
              <tbody>
                {list.map((p) => {
                  const m = p.price ? ((p.price - p.avgCost) / p.price) * 100 : 0
                  return (
                    <tr key={p.id} onClick={() => nav.go({ name: 'product', id: p.id })} className="cursor-pointer border-b border-line last:border-0 hover:bg-[#fcfaf6]">
                      <td className={td}><div className="flex items-center gap-3"><ProductMark p={p} size={36} /><div><p className="font-medium">{pname(p)}</p><p className="num text-xs text-muted">{p.sku}</p></div></div></td>
                      <td className={td + ' text-muted'}>{t(...CATEGORIES[p.category])}</td>
                      <td className={td}><span className="inline-flex items-center gap-1.5 text-muted">{p.unit === 'weight' ? <Scale size={14} /> : <PackIcon size={14} />}{p.unit === 'weight' ? t('وزن', 'Weight') : t('قطعة', 'Piece')}{p.packs.length > 0 && <Badge tone="amber">+{p.packs.length} {t('عبوات', 'packs')}</Badge>}</span></td>
                      <td className={td + ' num text-end font-medium'}>{f.n2(p.price)} <span className="text-xs text-muted">{f.per(p.unit)}</span></td>
                      <td className={td + ' num text-end text-muted'}>{f.n2(p.avgCost)}</td>
                      <td className={td + ' num text-end'}><span className={m < 15 ? 'text-[#a63d2f]' : 'text-forest'}>{f.pct(m)}</span></td>
                      <td className={td + ' num text-end'}>{f.qty(p.unit, p.stock)}</td>
                      <td className={td}><StockBadge p={p} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

export function ProductDetails({ id }: { id: string }) {
  const { state, t, pname, deleteProduct } = useStore()
  const f = useFmt()
  const nav = useNav()
  const toast = useToast()
  const [del, setDel] = useState(false)
  const p = state.products.find((x) => x.id === id)
  if (!p) return <Empty title={t('المنتج غير موجود', 'Product not found')} action={<Button onClick={() => nav.go({ name: 'products' })}>{t('العودة للمنتجات', 'Back to products')}</Button>} />
  const moves = state.movements.filter((m) => m.productId === id).slice().reverse()
  const since = Date.now() - 30 * 86400000
  let sold = 0, rev = 0, cost = 0
  state.sales.filter((s) => s.date >= since).forEach((s) => s.lines.forEach((l) => { if (l.productId === id) { sold += l.qty; rev += l.total; cost += l.cost } }))
  const margin = p.price ? ((p.price - p.avgCost) / p.price) * 100 : 0
  const value = (p.unit === 'weight' ? p.stock / 1000 : p.stock) * p.avgCost
  const pct = Math.min(100, (p.stock / Math.max(p.lowStock * 3, 1)) * 100)

  return (
    <div>
      <button onClick={() => nav.go({ name: 'products' })} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-forest cursor-pointer"><ArrowRight size={15} className="ltr:rotate-180" />{t('المنتجات', 'Products')}</button>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <ProductMark p={p} size={64} />
          <div>
            <div className="flex items-center gap-3"><h1 className="text-[26px] font-semibold text-forest">{pname(p)}</h1><StockBadge p={p} /></div>
            <p className="num mt-1 text-sm text-muted">{p.sku} · {t(...CATEGORIES[p.category])} · {p.unit === 'weight' ? t('يباع بالوزن', 'Sold by weight') : t('يباع بالقطعة', 'Sold by piece')}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button icon={<Pencil size={15} />} onClick={() => nav.openProductForm(p.id)}>{t('تعديل', 'Edit')}</Button>
          <Button icon={<SlidersHorizontal size={15} />} onClick={() => nav.openStock('adjust', p.id)}>{t('تسوية', 'Adjust')}</Button>
          <Button variant="primary" icon={<PackagePlus size={15} />} onClick={() => nav.openStock('receive', p.id)}>{t('استلام بضاعة', 'Receive stock')}</Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card className="grid grid-cols-2 divide-line md:grid-cols-4 md:divide-x rtl:md:divide-x-reverse">
            {[[t('سعر البيع', 'Selling price'), f.money(p.price), f.per(p.unit)], [t('متوسط التكلفة', 'Avg. cost'), f.money(p.avgCost), t('مرجّح متحرك', 'moving weighted')], [t('هامش الوحدة', 'Unit margin'), f.pct(margin), f.money(p.price - p.avgCost)], [t('قيمة المخزون', 'Stock value'), f.money(value), t('بالتكلفة', 'at cost')]].map(([k, v, s]) => (
              <div key={k} className="p-5"><p className="text-xs text-muted">{k}</p><p className="num mt-1 text-lg font-semibold text-forest">{v}</p><p className="num text-xs text-muted">{s}</p></div>
            ))}
          </Card>
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-5 pb-3">
              <h3 className="font-semibold text-forest">{t('حركات المخزون', 'Stock movements')}</h3>
              <button onClick={() => nav.go({ name: 'movements', id: p.id })} className="text-[13px] font-medium text-[#8a5a1c] hover:underline cursor-pointer">{t('عرض الكل', 'View all')}</button>
            </div>
            {moves.length === 0 ? <p className="px-6 pb-8 text-sm text-muted">{t('لا توجد حركات بعد', 'No movements yet')}</p> : (
              <table className="w-full">
                <tbody>
                  {moves.slice(0, 10).map((m) => (
                    <tr key={m.id} className="border-t border-line">
                      <td className={td}><MoveTypeBadge type={m.type} /></td>
                      <td className={td + ' num text-muted'}>{f.date(m.date)} {f.time(m.date)}</td>
                      <td className={td + ' max-w-[200px] truncate text-muted'}>{m.ref ?? m.note ?? '—'}</td>
                      <td className={cx(td, 'num text-end font-medium', m.qty < 0 ? 'text-[#a63d2f]' : 'text-[#2c6a4c]')}>{m.qty > 0 ? '+' : '−'}{f.qty(p.unit, Math.abs(m.qty))}</td>
                      <td className={td + ' num text-end text-muted'}>{f.qty(p.unit, m.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
        <div className="space-y-6">
          <Card className="p-6">
            <p className="text-xs text-muted">{t('الرصيد الحالي', 'On hand')}</p>
            <p className="num mt-1 text-3xl font-semibold text-forest">{f.qty(p.unit, p.stock)}</p>
            <div className="mt-4 h-2 rounded-full bg-[#f1ede4]"><div className={cx('h-full rounded-full', stockStatus(p) === 'ok' ? 'bg-forest' : stockStatus(p) === 'low' ? 'bg-amber' : 'bg-[#a63d2f]')} style={{ width: `${pct}%` }} /></div>
            <p className="num mt-2 text-xs text-muted">{t('حد التنبيه', 'Alert threshold')}: {f.qty(p.unit, p.lowStock)}</p>
          </Card>
          <Card className="p-6">
            <h3 className="mb-3 font-semibold text-forest">{t('آخر ٣٠ يوم', 'Last 30 days')}</h3>
            {[[t('الكمية المباعة', 'Quantity sold'), f.qty(p.unit, sold)], [t('المبيعات', 'Sales'), f.money(rev)], [t('مجمل الربح', 'Gross profit'), f.money(rev - cost)]].map(([k, v]) => (
              <div key={k} className="flex justify-between border-t border-line py-2.5 text-sm first:border-0"><span className="text-muted">{k}</span><span className="num font-medium">{v}</span></div>
            ))}
          </Card>
          {p.packs.length > 0 && (
            <Card className="p-6">
              <h3 className="font-semibold text-forest">{t('العبوات الجاهزة', 'Predefined packs')}</h3>
              <p className="mb-3 text-xs text-muted">{t('تُخصم من الرصيد السائب', 'Drawn from bulk stock')}</p>
              {p.packs.map((k) => (
                <div key={k.id} className="flex justify-between border-t border-line py-2.5 text-sm"><span className="num">{f.qty('weight', k.grams)}</span><span className="num font-medium">{f.money(k.price)}</span><span className="num text-xs text-muted">≈ {Math.floor(p.stock / k.grams)} {t('عبوة متاحة', 'available')}</span></div>
              ))}
            </Card>
          )}
          <button onClick={() => setDel(true)} className="inline-flex items-center gap-2 text-sm text-[#a63d2f] hover:underline cursor-pointer"><Trash2 size={14} />{t('أرشفة المنتج', 'Archive product')}</button>
        </div>
      </div>
      <Confirm open={del} onClose={() => setDel(false)} danger title={t('أرشفة المنتج؟', 'Archive product?')} confirmLabel={t('أرشفة', 'Archive')}
        body={t(`سيتم إخفاء "${p.nameAr}" من الكتالوج مع الاحتفاظ بكل حركات المخزون والمبيعات.`, `"${p.nameEn}" will be hidden from the catalog while all stock movements and sales history are preserved.`)}
        onConfirm={() => { Promise.resolve(deleteProduct(p.id)).then(() => { toast(t('تم حذف المنتج', 'Product archived')); nav.go({ name: 'products' }) }).catch(() => toast(t('تعذر أرشفة المنتج', 'Could not archive the product'), 'error')) }} />
    </div>
  )
}

interface FormState { nameAr: string; nameEn: string; sku: string; category: string; unit: Unit; price: string; lowStock: string; openQty: string; openCost: string; packs: { id: string; grams: string; price: string }[] }

export function ProductForm({ open, id, onClose }: { open: boolean; id?: string; onClose: () => void }) {
  const { state, t, saveProduct } = useStore()
  const toast = useToast()
  const nav = useNav()
  const editing = id ? state.products.find((p) => p.id === id) : undefined
  const blank: FormState = { nameAr: '', nameEn: '', sku: 'GB-' + (101 + state.products.length + Math.floor(Math.random() * 50)), category: 'nuts', unit: 'weight', price: '', lowStock: '', openQty: '', openCost: '', packs: [] }
  const [v, setV] = useState<FormState>(blank)
  const [err, setErr] = useState<Record<string, string>>({})
  useEffect(() => {
    if (!open) return
    setErr({})
    if (editing) {
      const k = editing.unit === 'weight' ? 1000 : 1
      setV({ nameAr: editing.nameAr, nameEn: editing.nameEn, sku: editing.sku, category: editing.category, unit: editing.unit, price: String(editing.price), lowStock: String(editing.lowStock / k), openQty: '', openCost: '', packs: editing.packs.map((p) => ({ id: p.id, grams: String(p.grams), price: String(p.price) })) })
    } else setV(blank)
  }, [open, id])
  const set = (k: keyof FormState, val: any) => setV((x) => ({ ...x, [k]: val }))
  const uLabel = v.unit === 'weight' ? t('كجم', 'kg') : t('قطعة', 'pcs')

  const submit = async () => {
    const e: Record<string, string> = {}
    if (!v.nameAr.trim()) e.nameAr = t('مطلوب', 'Required')
    if (!v.nameEn.trim()) e.nameEn = t('مطلوب', 'Required')
    if (!v.sku.trim()) e.sku = t('مطلوب', 'Required')
    else if (state.products.some((p) => p.sku.toLowerCase() === v.sku.trim().toLowerCase() && p.id !== id)) e.sku = t('الكود مستخدم بالفعل', 'SKU already in use')
    if (!(parseFloat(v.price) > 0)) e.price = t('أدخل سعراً أكبر من صفر', 'Enter a price above zero')
    if (v.lowStock === '' || parseFloat(v.lowStock) < 0) e.lowStock = t('أدخل حداً صحيحاً', 'Enter a valid threshold')
    if (!editing) {
      const oq = parseFloat(v.openQty || '0')
      if (oq < 0 || (v.unit === 'piece' && !Number.isInteger(oq))) e.openQty = t('كمية غير صحيحة', 'Invalid quantity')
      if (oq > 0 && !(parseFloat(v.openCost) > 0)) e.openCost = t('أدخل تكلفة الوحدة', 'Enter unit cost')
    }
    v.packs.forEach((p, i) => { if (!(parseInt(p.grams) > 0) || !(parseFloat(p.price) > 0)) e['pack' + i] = t('أدخل الوزن والسعر', 'Enter weight and price') })
    setErr(e)
    if (Object.keys(e).length) return
    const k = v.unit === 'weight' ? 1000 : 1
    const pid = editing?.id ?? 'P' + uid()
    const product: Product = {
      id: pid, sku: v.sku.trim(), nameAr: v.nameAr.trim(), nameEn: v.nameEn.trim(), category: v.category, unit: v.unit, price: parseFloat(v.price),
      lowStock: Math.round(parseFloat(v.lowStock) * k), stock: editing?.stock ?? 0, avgCost: editing?.avgCost ?? 0, createdAt: editing?.createdAt ?? Date.now(),
      packs: v.unit === 'weight' ? v.packs.map((p): Pack => ({ id: p.id, grams: parseInt(p.grams), price: parseFloat(p.price) })) : [],
    }
    const oq = parseFloat(v.openQty || '0')
    try { await saveProduct(product, editing ? undefined : { qty: Math.round(oq * k), cost: parseFloat(v.openCost || '0') }) }
    catch { toast(t('تعذر حفظ المنتج', 'Could not save the product'), 'error'); return }
    toast(editing ? t('تم حفظ التعديلات', 'Changes saved') : t('تمت إضافة المنتج', 'Product added'))
    onClose()
    if (!editing) nav.go({ name: 'product', id: pid })
  }

  return (
    <Drawer open={open} onClose={onClose} title={editing ? t('تعديل المنتج', 'Edit product') : t('منتج جديد', 'New product')} subtitle={editing ? <span className="num">{editing.sku}</span> : t('أضف منتجاً للكتالوج ونقطة البيع', 'Add a product to the catalog and POS')}
      footer={<><Button variant="ghost" onClick={onClose}>{t('إلغاء', 'Cancel')}</Button><Button variant="primary" onClick={submit}>{editing ? t('حفظ', 'Save changes') : t('إضافة المنتج', 'Add product')}</Button></>}>
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <Field label={t('الاسم بالعربية', 'Arabic name')} error={err.nameAr}><input dir="rtl" className={inputCls} value={v.nameAr} onChange={(e) => set('nameAr', e.target.value)} /></Field>
          <Field label={t('الاسم بالإنجليزية', 'English name')} error={err.nameEn}><input dir="ltr" className={inputCls} value={v.nameEn} onChange={(e) => set('nameEn', e.target.value)} /></Field>
          <Field label={t('الكود (SKU)', 'SKU')} error={err.sku}><input dir="ltr" className={inputCls + ' num'} value={v.sku} onChange={(e) => set('sku', e.target.value)} /></Field>
          <Field label={t('التصنيف', 'Category')}><select className={inputCls} value={v.category} onChange={(e) => set('category', e.target.value)}>{Object.entries(CATEGORIES).map(([k, c]) => <option key={k} value={k}>{t(c[0], c[1])}</option>)}</select></Field>
        </div>
        <div>
          <p className="mb-1.5 text-[13px] font-medium text-olive/80">{t('طريقة البيع', 'Selling method')}</p>
          <div className="grid grid-cols-2 gap-3">
            {([['weight', Scale, t('بالوزن', 'By weight'), t('سائب بالجرام والكيلو، مع عبوات اختيارية', 'Bulk in grams/kg, optional packs')], ['piece', PackIcon, t('بالقطعة', 'By piece'), t('منتج معبأ برصيد مستقل', 'Packaged item, own stock')]] as const).map(([val, Icon, l, d]) => (
              <button key={val} type="button" disabled={!!editing} onClick={() => set('unit', val)} className={cx('rounded-xl border p-4 text-start transition cursor-pointer disabled:cursor-not-allowed', v.unit === val ? 'border-forest bg-forest/[.04] ring-2 ring-forest/15' : 'border-line hover:border-forest/30', editing && v.unit !== val && 'opacity-40')}>
                <Icon size={18} className="text-forest" /><p className="mt-2 text-sm font-medium">{l}</p><p className="mt-0.5 text-xs text-muted">{d}</p>
              </button>
            ))}
          </div>
          {editing && <p className="mt-1.5 text-xs text-muted">{t('لا يمكن تغيير طريقة البيع بعد إنشاء المنتج', 'Selling method cannot change after creation')}</p>}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label={`${t('سعر البيع', 'Selling price')} (${t('ج.م', 'EGP')} / ${uLabel})`} error={err.price}><input type="number" min={0} className={inputCls + ' num'} value={v.price} onChange={(e) => set('price', e.target.value)} /></Field>
          <Field label={`${t('حد تنبيه المخزون', 'Low-stock alert')} (${uLabel})`} error={err.lowStock}><input type="number" min={0} className={inputCls + ' num'} value={v.lowStock} onChange={(e) => set('lowStock', e.target.value)} /></Field>
        </div>
        {!editing && (
          <div className="rounded-xl bg-[#f6f2ea] p-4">
            <p className="text-sm font-medium text-forest">{t('الرصيد الافتتاحي', 'Opening stock')}</p>
            <p className="mb-3 text-xs text-muted">{t('اختياري — يبدأ منه متوسط التكلفة', 'Optional — seeds the average cost')}</p>
            <div className="grid grid-cols-2 gap-4">
              <Field label={`${t('الكمية', 'Quantity')} (${uLabel})`} error={err.openQty}><input type="number" min={0} className={inputCls + ' num'} value={v.openQty} onChange={(e) => set('openQty', e.target.value)} /></Field>
              <Field label={`${t('تكلفة الوحدة', 'Unit cost')} (${t('ج.م', 'EGP')} / ${uLabel})`} error={err.openCost}><input type="number" min={0} className={inputCls + ' num'} value={v.openCost} onChange={(e) => set('openCost', e.target.value)} /></Field>
            </div>
          </div>
        )}
        {v.unit === 'weight' && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div><p className="text-sm font-medium text-forest">{t('عبوات جاهزة', 'Predefined packs')}</p><p className="text-xs text-muted">{t('أوزان ثابتة بسعر خاص تُخصم من الرصيد السائب', 'Fixed weights with own price, drawn from bulk')}</p></div>
              <Button size="sm" icon={<Plus size={14} />} onClick={() => set('packs', [...v.packs, { id: uid(), grams: '250', price: '' }])}>{t('عبوة', 'Pack')}</Button>
            </div>
            {v.packs.map((p, i) => (
              <div key={p.id} className="mb-2">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1"><input type="number" className={inputCls + ' num pe-12'} value={p.grams} onChange={(e) => set('packs', v.packs.map((x, j) => (j === i ? { ...x, grams: e.target.value } : x)))} /><span className="absolute end-3 top-2.5 text-xs text-muted">{t('جم', 'g')}</span></div>
                  <div className="relative flex-1"><input type="number" className={inputCls + ' num pe-12'} placeholder={t('السعر', 'Price')} value={p.price} onChange={(e) => set('packs', v.packs.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} /><span className="absolute end-3 top-2.5 text-xs text-muted">{t('ج.م', 'EGP')}</span></div>
                  <button onClick={() => set('packs', v.packs.filter((_, j) => j !== i))} className="rounded-lg p-2 text-muted hover:bg-[#f8e3df] hover:text-[#a63d2f] cursor-pointer"><Trash2 size={15} /></button>
                </div>
                {err['pack' + i] && <p className="mt-1 text-xs text-[#a63d2f]">{err['pack' + i]}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </Drawer>
  )
}
