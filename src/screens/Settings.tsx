import { useRef, useState } from 'react'
import { Download, Upload, RotateCcw, Database, ShieldAlert, Languages } from 'lucide-react'
import { useStore, useFmt, type State } from '../store'
import { Button, Card, Field, PageHeader, Confirm, Segmented, useToast, inputCls } from '../ui'

export default function Settings() {
  const { state, t, saveSettings, restore, reset, lang, setLang, savedAt } = useStore()
  const f = useFmt()
  const toast = useToast()
  const [s, setS] = useState(state.settings)
  const [pending, setPending] = useState<State | null>(null)
  const [resetAsk, setResetAsk] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const dirty = JSON.stringify(s) !== JSON.stringify(state.settings)

  const exportBackup = () => {
    const blob = new Blob([JSON.stringify({ app: 'gharbawy-bazaar', version: 1, exportedAt: new Date().toISOString(), data: state }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `gharbawy-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    toast(t('تم تنزيل النسخة الاحتياطية', 'Backup downloaded'))
  }
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fl = e.target.files?.[0]
    e.target.value = ''
    if (!fl) return
    fl.text().then((txt) => {
      try {
        const j = JSON.parse(txt)
        const d = j.data ?? j
        if (!Array.isArray(d.products) || !Array.isArray(d.sales) || !Array.isArray(d.movements) || !d.settings) throw 0
        setPending(d)
      } catch { toast(t('الملف غير صالح كنسخة احتياطية', 'This file is not a valid backup'), 'error') }
    })
  }

  return (
    <div className="max-w-3xl">
      <PageHeader title={t('الإعدادات', 'Settings')} subtitle={t('بيانات المحل والإيصال والنسخ الاحتياطي', 'Store details, receipt and backups')} />
      <Card className="mb-6 p-6">
        <h3 className="mb-4 font-semibold text-forest">{t('بيانات المحل', 'Store details')}</h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label={t('اسم المحل', 'Store name')}><input className={inputCls} value={s.storeName} onChange={(e) => setS({ ...s, storeName: e.target.value })} /></Field>
          <Field label={t('اسم المستخدم الظاهر', 'Display name')}><input className={inputCls} value={s.cashier} onChange={(e) => setS({ ...s, cashier: e.target.value })} /></Field>
          <Field label={t('الهاتف', 'Phone')}><input className={inputCls + ' num'} dir="ltr" value={s.phone} onChange={(e) => setS({ ...s, phone: e.target.value })} /></Field>
          <Field label={t('العنوان', 'Address')}><input className={inputCls} value={s.address} onChange={(e) => setS({ ...s, address: e.target.value })} /></Field>
          <Field className="col-span-2" label={t('تذييل الإيصال', 'Receipt footer')}><input className={inputCls} value={s.receiptFooter} onChange={(e) => setS({ ...s, receiptFooter: e.target.value })} /></Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          {dirty && <Button variant="ghost" onClick={() => setS(state.settings)}>{t('تجاهل', 'Discard')}</Button>}
          <Button variant="primary" disabled={!dirty || !s.storeName.trim()} onClick={() => { saveSettings(s); toast(t('تم حفظ الإعدادات', 'Settings saved')) }}>{t('حفظ', 'Save')}</Button>
        </div>
      </Card>

      <Card className="mb-6 flex items-center justify-between p-6">
        <div className="flex items-center gap-3"><Languages size={18} className="text-forest" /><div><p className="font-semibold text-forest">{t('اللغة', 'Language')}</p><p className="text-xs text-muted">{t('العربية لغة أساسية مع دعم كامل للإنجليزية', 'Arabic primary with full English support')}</p></div></div>
        <Segmented value={lang} onChange={setLang} options={[{ value: 'ar', label: 'العربية' }, { value: 'en', label: 'English' }]} />
      </Card>

      <Card className="p-6">
        <h3 className="flex items-center gap-2 font-semibold text-forest"><Database size={17} />{t('البيانات والنسخ الاحتياطي', 'Data & backup')}</h3>
        <div className="mt-3 flex items-start gap-3 rounded-xl border border-amber/40 bg-amber-soft/60 px-4 py-3 text-sm text-[#7a5016]">
          <ShieldAlert size={17} className="mt-0.5 shrink-0" />
          <p>{t('هذه نسخة تجريبية: البيانات محفوظة في تخزين هذا المتصفح فقط (localStorage) وليست قاعدة بيانات إنتاجية. صدّر نسخة احتياطية بانتظام.', 'Prototype storage: data lives only in this browser (localStorage), not a production database. Export backups regularly.')}</p>
        </div>
        <p className="num mt-3 text-xs text-muted">{t('آخر حفظ تلقائي', 'Last auto-save')}: {f.time(savedAt)} · {state.products.length} {t('منتج', 'products')} · {state.sales.length} {t('فاتورة', 'invoices')} · {state.movements.length} {t('حركة', 'movements')}</p>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <Button icon={<Download size={16} />} onClick={exportBackup}>{t('تصدير نسخة احتياطية', 'Export backup')}</Button>
          <Button icon={<Upload size={16} />} onClick={() => file.current?.click()}>{t('استعادة من ملف', 'Restore from file')}</Button>
          <Button variant="ghost" className="!text-[#a63d2f]" icon={<RotateCcw size={16} />} onClick={() => setResetAsk(true)}>{t('إعادة بيانات العرض', 'Reset demo data')}</Button>
        </div>
        <input ref={file} type="file" accept="application/json,.json" className="hidden" onChange={onFile} />
      </Card>

      <Confirm open={!!pending} onClose={() => setPending(null)} danger title={t('استعادة النسخة الاحتياطية؟', 'Restore this backup?')} confirmLabel={t('استعادة', 'Restore')}
        body={pending && <>{t('سيتم استبدال كل البيانات الحالية بمحتوى الملف:', 'All current data will be replaced with the file contents:')}<span className="num mt-2 block font-medium">{pending.products.length} {t('منتج', 'products')} · {pending.sales.length} {t('فاتورة', 'invoices')}</span></>}
        onConfirm={() => { restore(pending!); setS(pending!.settings); toast(t('تمت الاستعادة بنجاح', 'Backup restored')) }} />
      <Confirm open={resetAsk} onClose={() => setResetAsk(false)} danger title={t('إعادة بيانات العرض؟', 'Reset demo data?')} confirmLabel={t('إعادة التعيين', 'Reset')}
        body={t('سيتم حذف كل التعديلات والفواتير الجديدة والرجوع للبيانات التجريبية الأصلية.', 'All changes and new invoices will be erased and the original demo data restored.')}
        onConfirm={() => { reset(); toast(t('تمت إعادة البيانات', 'Demo data reset')) }} />
    </div>
  )
}
