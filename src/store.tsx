import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type Lang = 'ar' | 'en'
export type Unit = 'weight' | 'piece'
export interface Pack { id: string; grams: number; price: number }
export interface Product {
  id: string; sku: string; nameAr: string; nameEn: string; category: string; unit: Unit
  /** price per kg (weight) or per piece */
  price: number
  /** base units: grams (weight) or pieces */
  stock: number
  /** moving weighted-average cost per kg or per piece */
  avgCost: number
  /** low-stock threshold in base units */
  lowStock: number
  packs: Pack[]
  createdAt: number
}
export type MoveType = 'opening' | 'receive' | 'sale' | 'adjust'
export interface Movement {
  id: string; productId: string; type: MoveType
  qty: number // signed base units
  unitCost: number // per kg / piece at time of movement
  balance: number
  date: number; note?: string; ref?: string
}
export interface SaleLine {
  productId: string; nameAr: string; nameEn: string; unit: Unit
  mode: 'weight' | 'piece' | 'pack'; packGrams?: number
  count: number // pieces or packs (1 for weight)
  qty: number // base units deducted
  unitPrice: number // per kg, piece or pack
  total: number
  cost: number // cost snapshot for the line
}
export interface Sale { id: string; number: string; date: number; lines: SaleLine[]; total: number; cash: number; change: number; cogs: number }
export interface Settings { storeName: string; phone: string; address: string; receiptFooter: string; cashier: string }
export interface State { products: Product[]; movements: Movement[]; sales: Sale[]; settings: Settings; seq: number }

export const CATEGORIES: Record<string, [string, string]> = {
  nuts: ['مكسرات', 'Nuts'],
  seeds: ['لب وبذور', 'Seeds'],
  dried: ['فواكه مجففة', 'Dried Fruits'],
  snacks: ['سناكس', 'Snacks'],
  sweets: ['حلويات شرقية', 'Oriental Sweets'],
  coffee: ['بن وتوابل', 'Coffee & Spices'],
}

export const uid = () => Math.random().toString(36).slice(2, 10)
export const costPerBase = (p: { unit: Unit; avgCost: number }) => (p.unit === 'weight' ? p.avgCost / 1000 : p.avgCost)
export const stockStatus = (p: Product): 'ok' | 'low' | 'out' => (p.stock <= 0 ? 'out' : p.stock <= p.lowStock ? 'low' : 'ok')
export const round2 = (n: number) => Math.round(n * 100) / 100

/* ---------------- Seed data ---------------- */
const DAY = 86400000
function seed(): State {
  let s = 20240611
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  const now = Date.now()
  const start = new Date(now - 40 * DAY); start.setHours(9, 0, 0, 0)
  type Def = [string, string, string, Unit, number, number, number, number, Pack[]?]
  // nameAr, nameEn, cat, unit, price, cost, openingStock(base), lowStock(base), packs
  const defs: Def[] = [
    ['كاجو محمص', 'Roasted Cashews', 'nuts', 'weight', 720, 540, 38000, 5000, [{ id: 'p1', grams: 250, price: 185 }, { id: 'p2', grams: 500, price: 365 }]],
    ['لوز مقشر', 'Blanched Almonds', 'nuts', 'weight', 640, 470, 30000, 5000, [{ id: 'p1', grams: 250, price: 165 }]],
    ['فستق حلبي', 'Aleppo Pistachios', 'nuts', 'weight', 980, 760, 16000, 4000, [{ id: 'p1', grams: 250, price: 250 }]],
    ['بندق محمص', 'Roasted Hazelnuts', 'nuts', 'weight', 690, 520, 9000, 4000],
    ['عين جمل', 'Walnuts', 'nuts', 'weight', 560, 410, 22000, 4000],
    ['سوداني بالقشر', 'In-shell Peanuts', 'nuts', 'weight', 110, 72, 60000, 8000, [{ id: 'p1', grams: 500, price: 58 }]],
    ['لب سوري', 'Syrian Seeds', 'seeds', 'weight', 240, 165, 40000, 6000, [{ id: 'p1', grams: 250, price: 62 }]],
    ['لب أبيض', 'White Pumpkin Seeds', 'seeds', 'weight', 200, 135, 35000, 6000],
    ['زبيب ذهبي', 'Golden Raisins', 'dried', 'weight', 280, 190, 18000, 4000],
    ['مشمش مجفف', 'Dried Apricots', 'dried', 'weight', 420, 300, 12000, 3000],
    ['تمر مجدول', 'Medjool Dates', 'dried', 'weight', 520, 380, 20000, 4000, [{ id: 'p1', grams: 500, price: 265 }]],
    ['بن محوج', 'Spiced Coffee', 'coffee', 'weight', 600, 420, 14000, 3000, [{ id: 'p1', grams: 125, price: 78 }, { id: 'p2', grams: 250, price: 152 }]],
    ['شيبسي ملح', 'Salted Chips 75g', 'snacks', 'piece', 15, 10.5, 140, 30],
    ['علبة مكسرات مشكلة هدية', 'Mixed Nuts Gift Box', 'nuts', 'piece', 450, 320, 24, 6],
    ['ملبن بالمكسرات', 'Malban with Nuts 400g', 'sweets', 'piece', 95, 62, 50, 12],
    ['حلاوة طحينية', 'Halawa Tahini 500g', 'sweets', 'piece', 85, 58, 9, 10],
  ]
  const products: Product[] = defs.map((d, i) => ({
    id: 'P' + (i + 1), sku: 'GB-' + String(101 + i), nameAr: d[0], nameEn: d[1], category: d[2], unit: d[3],
    price: d[4], avgCost: d[5], stock: 0, lowStock: d[7], packs: d[8] ?? [], createdAt: start.getTime(),
  }))
  const movements: Movement[] = []
  products.forEach((p, i) => {
    p.stock = defs[i][6]
    movements.push({ id: uid(), productId: p.id, type: 'opening', qty: p.stock, unitCost: p.avgCost, balance: p.stock, date: start.getTime(), note: 'رصيد افتتاحي' })
  })
  const sales: Sale[] = []
  let seq = 1000
  for (let d = 30; d >= 0; d--) {
    const day = new Date(now - d * DAY)
    // receiving events
    if (d === 18 || d === 6) {
      products.forEach((p, i) => {
        if (i % 3 !== d % 3) return
        const qty = p.unit === 'weight' ? 10000 : 30
        const cost = round2(defs[i][5] * (1 + (rnd() * 0.08 - 0.02)))
        const old = p.stock / (p.unit === 'weight' ? 1000 : 1)
        const add = qty / (p.unit === 'weight' ? 1000 : 1)
        p.avgCost = round2((old * p.avgCost + add * cost) / (old + add))
        p.stock += qty
        const t = new Date(day); t.setHours(10, 0)
        movements.push({ id: uid(), productId: p.id, type: 'receive', qty, unitCost: cost, balance: p.stock, date: t.getTime(), note: 'مورد: الشركة المصرية للمكسرات' })
      })
    }
    const count = d === 0 ? 4 : 3 + Math.floor(rnd() * 5)
    for (let k = 0; k < count; k++) {
      const t = new Date(day); t.setHours(11 + Math.floor(rnd() * 10), Math.floor(rnd() * 60))
      if (d === 0 && t.getTime() > now) t.setTime(now - (k + 1) * 1800000)
      const lines: SaleLine[] = []
      const n = 1 + Math.floor(rnd() * 3)
      for (let j = 0; j < n; j++) {
        const p = products[Math.floor(rnd() * products.length)]
        if (lines.find((l) => l.productId === p.id)) continue
        let line: SaleLine
        if (p.unit === 'piece') {
          const c = 1 + Math.floor(rnd() * 3)
          line = { productId: p.id, nameAr: p.nameAr, nameEn: p.nameEn, unit: p.unit, mode: 'piece', count: c, qty: c, unitPrice: p.price, total: c * p.price, cost: round2(c * p.avgCost) }
        } else if (p.packs.length && rnd() < 0.4) {
          const pk = p.packs[0]
          line = { productId: p.id, nameAr: p.nameAr, nameEn: p.nameEn, unit: p.unit, mode: 'pack', packGrams: pk.grams, count: 1, qty: pk.grams, unitPrice: pk.price, total: pk.price, cost: round2((pk.grams / 1000) * p.avgCost) }
        } else {
          const g = [250, 500, 750, 1000, 125][Math.floor(rnd() * 5)]
          line = { productId: p.id, nameAr: p.nameAr, nameEn: p.nameEn, unit: p.unit, mode: 'weight', count: 1, qty: g, unitPrice: p.price, total: round2((g / 1000) * p.price), cost: round2((g / 1000) * p.avgCost) }
        }
        if (p.stock < line.qty) continue
        p.stock -= line.qty
        lines.push(line)
      }
      if (!lines.length) continue
      seq++
      const total = round2(lines.reduce((a, l) => a + l.total, 0))
      const cash = Math.ceil(total / 50) * 50
      const id = uid()
      const number = 'INV-' + seq
      sales.push({ id, number, date: t.getTime(), lines, total, cash, change: round2(cash - total), cogs: round2(lines.reduce((a, l) => a + l.cost, 0)) })
      lines.forEach((l) => {
        const p = products.find((x) => x.id === l.productId)!
        movements.push({ id: uid(), productId: p.id, type: 'sale', qty: -l.qty, unitCost: p.avgCost, balance: p.stock, date: t.getTime(), ref: number })
      })
    }
  }
  // make one item out of stock for realism
  const hz = products.find((p) => p.id === 'P16')!
  if (hz.stock > 0) {
    movements.push({ id: uid(), productId: hz.id, type: 'adjust', qty: -hz.stock, unitCost: hz.avgCost, balance: 0, date: now - 3 * 3600000, note: 'تالف — انتهاء صلاحية' })
    hz.stock = 0
  }
  movements.sort((a, b) => a.date - b.date)
  sales.sort((a, b) => b.date - a.date)
  return {
    products, movements, sales, seq,
    settings: { storeName: 'بازار الغرباوي', phone: '01001234567', address: 'شارع الجيش، المنصورة', receiptFooter: 'شكراً لزيارتكم — بازار الغرباوي', cashier: 'أحمد الغرباوي' },
  }
}

/* ---------------- Store ---------------- */
const KEY = 'gharbawy-bazaar-v1'
export interface CartLine { key: string; productId: string; mode: 'weight' | 'piece' | 'pack'; packId?: string; qty: number /* grams for weight, count otherwise */ }

export function lineInfo(p: Product, c: CartLine) {
  if (c.mode === 'weight') return { base: c.qty, unitPrice: p.price, total: round2((c.qty / 1000) * p.price), packGrams: undefined as number | undefined }
  if (c.mode === 'pack') {
    const pk = p.packs.find((x) => x.id === c.packId)!
    return { base: pk.grams * c.qty, unitPrice: pk.price, total: round2(pk.price * c.qty), packGrams: pk.grams }
  }
  return { base: c.qty, unitPrice: p.price, total: round2(p.price * c.qty), packGrams: undefined }
}

function useStoreImpl() {
  const [state, setState] = useState<State>(() => {
    try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw) } catch {}
    return seed()
  })
  const [lang, setLangState] = useState<Lang>(() => (localStorage.getItem(KEY + '-lang') as Lang) || 'ar')
  const [user, setUser] = useState<string | null>(() => sessionStorage.getItem(KEY + '-user'))
  const [savedAt, setSavedAt] = useState<number>(Date.now())

  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(state)); setSavedAt(Date.now()) }, [state])
  useEffect(() => {
    localStorage.setItem(KEY + '-lang', lang)
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
  }, [lang])

  const t = (ar: string, en: string) => (lang === 'ar' ? ar : en)
  const pname = (p: { nameAr: string; nameEn: string }) => (lang === 'ar' ? p.nameAr : p.nameEn)

  const actions = {
    login(u: string) { sessionStorage.setItem(KEY + '-user', u); setUser(u) },
    logout() { sessionStorage.removeItem(KEY + '-user'); setUser(null) },
    saveProduct(p: Product, opening?: { qty: number; cost: number }) {
      setState((s) => {
        const exists = s.products.some((x) => x.id === p.id)
        if (exists) return { ...s, products: s.products.map((x) => (x.id === p.id ? { ...x, ...p, stock: x.stock, avgCost: x.avgCost } : x)) }
        const np = { ...p, stock: opening?.qty ?? 0, avgCost: opening?.cost ?? 0 }
        const mv: Movement[] = opening && opening.qty > 0 ? [{ id: uid(), productId: p.id, type: 'opening', qty: opening.qty, unitCost: opening.cost, balance: opening.qty, date: Date.now(), note: t('رصيد افتتاحي', 'Opening stock') }] : []
        return { ...s, products: [np, ...s.products], movements: [...s.movements, ...mv] }
      })
    },
    deleteProduct(id: string) {
      setState((s) => ({ ...s, products: s.products.filter((p) => p.id !== id), movements: s.movements.filter((m) => m.productId !== id) }))
    },
    receive(productId: string, qty: number, cost: number, note: string) {
      setState((s) => {
        const products = s.products.map((p) => {
          if (p.id !== productId) return p
          const f = p.unit === 'weight' ? 1000 : 1
          const old = Math.max(p.stock, 0) / f, add = qty / f
          const avgCost = old + add > 0 ? round2((old * p.avgCost + add * cost) / (old + add)) : cost
          return { ...p, stock: p.stock + qty, avgCost }
        })
        const p = products.find((x) => x.id === productId)!
        return { ...s, products, movements: [...s.movements, { id: uid(), productId, type: 'receive', qty, unitCost: cost, balance: p.stock, date: Date.now(), note }] }
      })
    },
    adjust(productId: string, delta: number, note: string) {
      setState((s) => {
        const products = s.products.map((p) => (p.id === productId ? { ...p, stock: p.stock + delta } : p))
        const p = products.find((x) => x.id === productId)!
        return { ...s, products, movements: [...s.movements, { id: uid(), productId, type: 'adjust', qty: delta, unitCost: p.avgCost, balance: p.stock, date: Date.now(), note }] }
      })
    },
    checkout(cart: CartLine[], cash: number): { ok: true; sale: Sale } | { ok: false; error: string } {
      const need: Record<string, number> = {}
      for (const c of cart) {
        const p = state.products.find((x) => x.id === c.productId)
        if (!p) return { ok: false, error: t('منتج غير موجود', 'Product not found') }
        need[p.id] = (need[p.id] ?? 0) + lineInfo(p, c).base
      }
      for (const id in need) {
        const p = state.products.find((x) => x.id === id)!
        if (need[id] > p.stock) return { ok: false, error: t(`الكمية غير كافية: ${p.nameAr}`, `Insufficient stock: ${p.nameEn}`) }
      }
      const lines: SaleLine[] = cart.map((c) => {
        const p = state.products.find((x) => x.id === c.productId)!
        const li = lineInfo(p, c)
        return { productId: p.id, nameAr: p.nameAr, nameEn: p.nameEn, unit: p.unit, mode: c.mode, packGrams: li.packGrams, count: c.mode === 'weight' ? 1 : c.qty, qty: li.base, unitPrice: li.unitPrice, total: li.total, cost: round2(li.base * costPerBase(p)) }
      })
      const total = round2(lines.reduce((a, l) => a + l.total, 0))
      if (cash < total) return { ok: false, error: t('المبلغ المستلم أقل من الإجمالي', 'Cash received is less than total') }
      const seq = state.seq + 1
      const sale: Sale = { id: uid(), number: 'INV-' + seq, date: Date.now(), lines, total, cash, change: round2(cash - total), cogs: round2(lines.reduce((a, l) => a + l.cost, 0)) }
      setState((s) => {
        const products = s.products.map((p) => (need[p.id] ? { ...p, stock: p.stock - need[p.id] } : p))
        const mv: Movement[] = Object.keys(need).map((id) => {
          const p = products.find((x) => x.id === id)!
          return { id: uid(), productId: id, type: 'sale', qty: -need[id], unitCost: p.avgCost, balance: p.stock, date: sale.date, ref: sale.number }
        })
        return { ...s, seq, products, sales: [sale, ...s.sales], movements: [...s.movements, ...mv] }
      })
      return { ok: true, sale }
    },
    saveSettings(st: Settings) { setState((s) => ({ ...s, settings: st })) },
    restore(data: State) { setState(data) },
    reset() { setState(seed()) },
  }

  return { state, lang, setLang: setLangState, user, t, pname, savedAt, ...actions }
}

type Store = ReturnType<typeof useStoreImpl>
const Ctx = createContext<Store>(null as any)
export function StoreProvider({ children }: { children: ReactNode }) {
  const store = useStoreImpl()
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}
export const useStore = () => useContext(Ctx)

/* ---------------- Formatting ---------------- */
export function useFmt() {
  const { lang } = useStore()
  return useMemo(() => {
    const n2 = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const money = (n: number) => `${n2(n)} ${lang === 'ar' ? 'ج.م' : 'EGP'}`
    const moneyShort = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 })
    const qty = (unit: Unit, base: number) => {
      if (unit === 'piece') return `${base.toLocaleString('en-US')} ${lang === 'ar' ? 'قطعة' : 'pcs'}`
      if (Math.abs(base) >= 1000) return `${(base / 1000).toLocaleString('en-US', { maximumFractionDigits: 2 })} ${lang === 'ar' ? 'كجم' : 'kg'}`
      return `${base.toLocaleString('en-US')} ${lang === 'ar' ? 'جم' : 'g'}`
    }
    const per = (unit: Unit) => (unit === 'weight' ? (lang === 'ar' ? '/ كجم' : '/ kg') : lang === 'ar' ? '/ قطعة' : '/ pc')
    const date = (d: number) => new Date(d).toLocaleDateString(lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    const time = (d: number) => new Date(d).toLocaleTimeString(lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { hour: '2-digit', minute: '2-digit' })
    const pct = (n: number) => `${(isFinite(n) ? n : 0).toFixed(1)}%`
    return { n2, money, moneyShort, qty, per, date, time, pct }
  }, [lang])
}
