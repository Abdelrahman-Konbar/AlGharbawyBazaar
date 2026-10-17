import { useEffect, useRef, useState } from 'react'
import { LayoutGrid, ScanLine, ReceiptText, Package, Warehouse, ArrowLeftRight, LineChart, Settings as Cog, LogOut, Languages, Bell, Search, Plus, ChevronLeft, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { StoreProvider, useStore, stockStatus, useFmt } from './store'
import { NavCtx, type Route } from './nav'
import { ToastProvider, Button, Logo, ProductMark, cx } from './ui'
import Login from './screens/Login'
import Dashboard from './screens/Dashboard'
import POS from './screens/POS'
import { SalesHistory, ReceiptModal } from './screens/Sales'
import { ProductsCatalog, ProductDetails, ProductForm } from './screens/Products'
import { InventoryOverview, Movements, StockDialog } from './screens/Inventory'
import Reports from './screens/Reports'
import Settings from './screens/Settings'

export default function App() {
  return (
    <StoreProvider>
      <ToastProvider>
        <Root />
      </ToastProvider>
    </StoreProvider>
  )
}

function Root() {
  const { user } = useStore()
  return user ? <Shell /> : <Login />
}

function Shell() {
  const store = useStore()
  const { t, can } = store
  const [route, setRoute] = useState<Route>({ name: 'dashboard' })
  const [form, setForm] = useState<{ open: boolean; id?: string }>({ open: false })
  const [stock, setStock] = useState<{ open: boolean; mode: 'receive' | 'adjust'; productId?: string }>({ open: false, mode: 'receive' })
  const [sale, setSale] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const main = useRef<HTMLDivElement>(null)

  const nav = {
    route,
    go: (r: Route) => { setRoute(r); main.current?.scrollTo({ top: 0 }) },
    openProductForm: (id?: string) => setForm({ open: true, id }),
    openStock: (mode: 'receive' | 'adjust', productId?: string) => setStock({ open: true, mode, productId }),
    openSale: (id: string) => setSale(id),
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'F2' && can('sell')) { e.preventDefault(); setRoute({ name: 'pos' }) } }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  useEffect(() => {
    const required = route.name === 'pos' ? 'sell' : route.name === 'sales' ? 'viewSales' : route.name === 'products' || route.name === 'product' ? 'manageProducts' : route.name === 'inventory' || route.name === 'movements' ? 'manageInventory' : route.name === 'reports' ? 'viewReports' : route.name === 'settings' ? 'manageSettings' : undefined
    if (required && !can(required)) setRoute({ name: 'dashboard' })
  }, [route.name, can])

  const items: { name: Route['name']; icon: any; label: string; group: number; permission?: import('../shared/contracts').Permission; badge?: number }[] = [
    { name: 'dashboard', icon: LayoutGrid, label: t('الرئيسية', 'Dashboard'), group: 0 },
    { name: 'pos', icon: ScanLine, label: t('نقطة البيع', 'Point of Sale'), group: 0, permission: 'sell' },
    { name: 'sales', icon: ReceiptText, label: t('سجل المبيعات', 'Sales History'), group: 0, permission: 'viewSales' },
    { name: 'products', icon: Package, label: t('المنتجات', 'Products'), group: 1, permission: 'manageProducts' },
    { name: 'inventory', icon: Warehouse, label: t('المخزون', 'Inventory'), group: 1, permission: 'manageInventory', badge: store.state.products.filter((p) => stockStatus(p) !== 'ok').length },
    { name: 'movements', icon: ArrowLeftRight, label: t('حركات المخزون', 'Stock Movements'), group: 1, permission: 'manageInventory' },
    { name: 'reports', icon: LineChart, label: t('الأرباح والتقارير', 'Profits & Reports'), group: 2, permission: 'viewReports' },
    { name: 'settings', icon: Cog, label: t('الإعدادات', 'Settings'), group: 2, permission: 'manageSettings' },
  ]
  const groups = [t('البيع', 'Selling'), t('البضاعة', 'Stock'), t('الإدارة', 'Manage')]
  const active = route.name === 'product' ? 'products' : route.name
  const isPOS = route.name === 'pos'

  return (
    <NavCtx.Provider value={nav}>
      <div className="flex h-screen overflow-hidden">
        <aside className={cx('pattern relative flex shrink-0 flex-col bg-forest text-ivory transition-[width] duration-300', collapsed ? 'w-[76px]' : 'w-[248px]')}>
          <div className="flex h-[72px] items-center px-5"><Logo light compact={collapsed} /></div>
          <nav className="flex-1 overflow-y-auto px-3 pb-4">
            {groups.map((g, gi) => (
              <div key={g} className="mt-4">
                {!collapsed && <p className="mb-1.5 px-3 text-[11px] font-medium uppercase tracking-[.16em] text-ivory/40">{g}</p>}
                {items.filter((i) => i.group === gi && (!i.permission || can(i.permission))).map((i) => {
                  const on = active === i.name
                  return (
                    <button key={i.name} title={i.label} onClick={() => nav.go({ name: i.name })}
                      className={cx('group relative mb-0.5 flex h-10 w-full items-center gap-3 rounded-[10px] px-3 text-[14px] transition cursor-pointer', on ? 'bg-ivory/[.09] text-ivory' : 'text-ivory/65 hover:bg-ivory/[.05] hover:text-ivory')}>
                      {on && <span className="absolute inset-y-2 start-0 w-[3px] rounded-full bg-amber" />}
                      <i.icon size={18} className={on ? 'text-amber' : ''} />
                      {!collapsed && <span className="flex-1 text-start">{i.label}</span>}
                      {!!i.badge && !collapsed && <span className="num rounded-full bg-amber px-1.5 text-[11px] font-semibold text-forest">{i.badge}</span>}
                      {i.name === 'pos' && !collapsed && <kbd className="num rounded border border-ivory/15 px-1 text-[10px] text-ivory/45">F2</kbd>}
                    </button>
                  )
                })}
              </div>
            ))}
          </nav>
          <div className="border-t border-ivory/10 p-3">
            <div className="flex items-center gap-3 rounded-xl px-2 py-2">
              <div className="grid size-9 shrink-0 place-items-center rounded-full bg-amber text-sm font-semibold text-forest">{store.state.settings.cashier.slice(0, 1)}</div>
              {!collapsed && <div className="min-w-0 flex-1 leading-tight"><p className="truncate text-sm">{store.state.settings.cashier}</p><p className="text-[11px] text-ivory/50">{t('مدير المحل', 'Store manager')}</p></div>}
              {!collapsed && <button title={t('تسجيل الخروج', 'Sign out')} onClick={store.logout} className="rounded-lg p-2 text-ivory/60 hover:bg-ivory/10 hover:text-ivory cursor-pointer"><LogOut size={16} className="rtl:rotate-180" /></button>}
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
          <main ref={main} className={cx('flex-1 overflow-y-auto', isPOS ? '' : 'px-8 py-7')}>
            <div key={route.name + (route.id ?? '')} className={cx('anim-up', isPOS ? 'h-full' : 'mx-auto max-w-[1280px]')}>
              {route.name === 'dashboard' && <Dashboard />}
              {route.name === 'pos' && <POS />}
              {route.name === 'sales' && <SalesHistory />}
              {route.name === 'products' && <ProductsCatalog initialQ={route.q} />}
              {route.name === 'product' && <ProductDetails id={route.id!} />}
              {route.name === 'inventory' && <InventoryOverview />}
              {route.name === 'movements' && <Movements initialProduct={route.id} />}
              {route.name === 'reports' && <Reports />}
              {route.name === 'settings' && <Settings />}
            </div>
          </main>
        </div>
      </div>
      <ProductForm open={form.open} id={form.id} onClose={() => setForm({ open: false })} />
      <StockDialog key={String(stock.open) + stock.mode + (stock.productId ?? '')} open={stock.open} mode={stock.mode} productId={stock.productId} onClose={() => setStock({ ...stock, open: false })} />
      <ReceiptModal id={sale} onClose={() => setSale(null)} />
    </NavCtx.Provider>
  )
}

function TopBar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { t, lang, setLang, state, pname, can } = useStore()
  const f = useFmt()
  const nav = { ...useNavSafe() }
  const [q, setQ] = useState('')
  const [bell, setBell] = useState(false)
  const [focus, setFocus] = useState(false)
  const alerts = state.products.filter((p) => stockStatus(p) !== 'ok')
  const results = q.trim() ? state.products.filter((p) => (p.nameAr + p.nameEn + p.sku).toLowerCase().includes(q.toLowerCase())).slice(0, 6) : []
  const today = new Date().toLocaleDateString(lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <header className="relative z-30 flex h-[72px] shrink-0 items-center gap-4 border-b border-line bg-ivory/90 px-6 backdrop-blur">
      <button onClick={onToggle} className="rounded-lg p-2 text-muted hover:bg-black/5 cursor-pointer" title={t('طي القائمة', 'Toggle sidebar')}>
        {collapsed ? <PanelLeftOpen size={18} className="rtl:-scale-x-100" /> : <PanelLeftClose size={18} className="rtl:-scale-x-100" />}
      </button>
      <div className="relative w-full max-w-md">
        <Search size={16} className="absolute start-3 top-3 text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => setFocus(true)} onBlur={() => setTimeout(() => setFocus(false), 150)}
          onKeyDown={(e) => { if (e.key === 'Enter' && q.trim()) { nav.go({ name: 'products', q }); setQ('') } }}
          placeholder={t('ابحث عن منتج بالاسم أو الكود…', 'Search products by name or SKU…')}
          className="h-10 w-full rounded-[10px] border border-line bg-white ps-9 pe-3 text-sm outline-none focus:border-forest focus:ring-4 focus:ring-forest/10" />
        {focus && q.trim() && (
          <div className="anim-pop absolute inset-x-0 top-12 overflow-hidden rounded-xl border border-line bg-white shadow-xl">
            {results.length === 0 ? <p className="px-4 py-5 text-center text-sm text-muted">{t('لا توجد نتائج', 'No matching products')}</p> : results.map((p) => (
              <button key={p.id} onMouseDown={() => { nav.go({ name: 'product', id: p.id }); setQ('') }} className="flex w-full items-center gap-3 px-3 py-2.5 text-start hover:bg-ivory cursor-pointer">
                <ProductMark p={p} size={32} />
                <div className="flex-1"><p className="text-sm font-medium">{pname(p)}</p><p className="num text-xs text-muted">{p.sku}</p></div>
                <span className="num text-xs text-muted">{f.qty(p.unit, p.stock)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="ms-auto flex items-center gap-2">
        <span className="hidden text-sm text-muted xl:block">{today}</span>
        <div className="mx-2 hidden h-6 w-px bg-line xl:block" />
        <button onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} className="inline-flex h-10 items-center gap-2 rounded-[10px] px-3 text-sm font-medium text-olive/75 hover:bg-black/5 cursor-pointer">
          <Languages size={17} /> <span className={lang === 'ar' ? 'font-[Inter]' : ''}>{lang === 'ar' ? 'EN' : 'ع'}</span>
        </button>
        <div className="relative">
          <button onClick={() => setBell(!bell)} className="relative grid size-10 place-items-center rounded-[10px] text-olive/75 hover:bg-black/5 cursor-pointer">
            <Bell size={18} />
            {alerts.length > 0 && <span className="absolute end-2 top-2 size-2 rounded-full bg-amber ring-2 ring-ivory" />}
          </button>
          {bell && (
            <>
              <div className="fixed inset-0" onClick={() => setBell(false)} />
              <div className="anim-pop absolute end-0 top-12 w-80 overflow-hidden rounded-xl border border-line bg-white shadow-xl">
                <p className="border-b border-line px-4 py-3 text-sm font-semibold text-forest">{t('تنبيهات المخزون', 'Stock alerts')} <span className="num text-muted">({alerts.length})</span></p>
                <div className="max-h-80 overflow-y-auto">
                  {alerts.length === 0 && <p className="px-4 py-6 text-center text-sm text-muted">{t('كل المنتجات متوفرة', 'Everything is well stocked')}</p>}
                  {alerts.map((p) => (
                    <button key={p.id} onClick={() => { setBell(false); nav.go({ name: 'product', id: p.id }) }} className="flex w-full items-center gap-3 px-4 py-2.5 text-start hover:bg-ivory cursor-pointer">
                      <span className={cx('size-2 rounded-full', p.stock <= 0 ? 'bg-[#a63d2f]' : 'bg-amber')} />
                      <span className="flex-1 text-sm">{pname(p)}</span>
                      <span className="num text-xs text-muted">{f.qty(p.unit, p.stock)}</span>
                      <ChevronLeft size={14} className="text-muted ltr:rotate-180" />
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
        {can('sell') && <Button variant="primary" icon={<Plus size={16} />} onClick={() => nav.go({ name: 'pos' })}>{t('بيع جديد', 'New sale')}</Button>}
      </div>
    </header>
  )
}

import { useNav } from './nav'
const useNavSafe = useNav
