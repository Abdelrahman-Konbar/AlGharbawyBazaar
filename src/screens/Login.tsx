import { useState } from 'react'
import { Lock, User, Languages, ArrowRight, Loader2 } from 'lucide-react'
import { useStore } from '../store'
import { Button, Field, inputCls } from '../ui'
import { Logo } from '../ui'

export default function Login() {
  const { t, lang, setLang, login } = useStore()
  const [u, setU] = useState('admin')
  const [p, setP] = useState('')
  const [err, setErr] = useState<{ u?: string; p?: string; form?: string }>({})
  const [loading, setLoading] = useState(false)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const er: typeof err = {}
    if (!u.trim()) er.u = t('أدخل اسم المستخدم', 'Enter your username')
    if (!p) er.p = t('أدخل كلمة المرور', 'Enter your password')
    setErr(er)
    if (er.u || er.p) return
    setLoading(true)
    setTimeout(() => {
      if (u.trim() === 'admin' && p === '1234') login(u.trim())
      else { setErr({ form: t('بيانات الدخول غير صحيحة. جرّب admin / 1234', 'Incorrect credentials. Try admin / 1234') }); setLoading(false) }
    }, 700)
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="pattern relative hidden flex-col justify-between overflow-hidden bg-forest p-12 text-ivory lg:flex">
        <Logo light />
        <div className="relative max-w-md">
          <p className="mb-4 text-[13px] font-medium uppercase tracking-[.2em] text-amber">{t('منذ ١٩٨٦ — المنصورة', 'Since 1986 — Mansoura')}</p>
          <h1 className="text-[44px] font-semibold leading-[1.15]">{t('كل حبة لها حساب.', 'Every grain, accounted for.')}</h1>
          <p className="mt-5 text-[15px] leading-relaxed text-ivory/70">{t('نظام إدارة متكامل للمنتجات والمخزون ونقطة البيع والأرباح — مصمم لإيقاع البازار اليومي.', 'One calm system for products, inventory, point of sale and profits — built for the daily rhythm of the bazaar.')}</p>
        </div>
        <div className="flex gap-10 text-sm text-ivory/60">
          {[[t('بالوزن', 'By weight'), t('جرام وكيلو', 'grams & kilos')], [t('متوسط التكلفة', 'Average cost'), t('مرجّح ومتحرك', 'moving weighted')], [t('ربح حقيقي', 'True profit'), t('لكل فاتورة', 'per invoice')]].map(([a, b]) => (
            <div key={a}><p className="font-semibold text-ivory">{a}</p><p>{b}</p></div>
          ))}
        </div>
        <div className="pointer-events-none absolute -bottom-32 -end-32 size-[420px] rounded-full border-[56px] border-amber/15" />
      </div>
      <div className="flex flex-col px-8 py-8">
        <div className="flex justify-between">
          <div className="lg:hidden"><Logo /></div>
          <button onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} className="ms-auto inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-olive/70 hover:bg-black/5 cursor-pointer">
            <Languages size={16} /> {lang === 'ar' ? 'English' : 'العربية'}
          </button>
        </div>
        <form onSubmit={submit} className="anim-up m-auto w-full max-w-sm">
          <h2 className="text-[28px] font-semibold text-forest">{t('أهلاً بعودتك', 'Welcome back')}</h2>
          <p className="mt-1.5 text-sm text-muted">{t('سجّل الدخول لبدء وردية اليوم', "Sign in to start today's shift")}</p>
          {err.form && <div className="mt-5 rounded-xl border border-[#efc9c1] bg-[#fbeeeb] px-4 py-3 text-sm text-[#a63d2f]">{err.form}</div>}
          <div className="mt-7 space-y-4">
            <Field label={t('اسم المستخدم', 'Username')} error={err.u}>
              <div className="relative"><User size={16} className="absolute start-3 top-3 text-muted" /><input className={inputCls + ' ps-9'} value={u} onChange={(e) => setU(e.target.value)} autoComplete="username" /></div>
            </Field>
            <Field label={t('كلمة المرور', 'Password')} error={err.p} hint={t('للتجربة: 1234', 'Demo password: 1234')}>
              <div className="relative"><Lock size={16} className="absolute start-3 top-3 text-muted" /><input type="password" autoFocus className={inputCls + ' ps-9'} value={p} onChange={(e) => setP(e.target.value)} autoComplete="current-password" /></div>
            </Field>
          </div>
          <Button variant="primary" size="lg" className="mt-7 w-full" disabled={loading}>
            {loading ? <Loader2 size={18} className="animate-spin" /> : <>{t('تسجيل الدخول', 'Sign in')} <ArrowRight size={17} className="rtl:rotate-180" /></>}
          </Button>
        </form>
        <p className="text-center text-xs text-muted">{t('نسخة تجريبية — البيانات محفوظة في المتصفح فقط', 'Prototype — data is stored in this browser only')}</p>
      </div>
    </div>
  )
}
