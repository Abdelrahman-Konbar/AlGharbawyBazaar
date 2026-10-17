import Database from 'better-sqlite3'
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type {
  AppState,
  CartLine,
  Movement,
  Pack,
  Product,
  ProductInput,
  Sale,
  SaleLine,
  Settings,
  Unit,
  Permission,
  UserRole,
  UserSession,
} from '../shared/contracts.js'

const MONEY_SCALE = 1000

export class DomainError extends Error {
  constructor(
    public readonly code: 'VALIDATION_ERROR' | 'NOT_FOUND' | 'DUPLICATE_SKU' | 'INSUFFICIENT_STOCK' | 'INVALID_OPERATION' | 'AUTHENTICATION_ERROR' | 'AUTHORIZATION_ERROR' | 'DATABASE_ERROR',
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'DomainError'
  }
}

const moneyToInt = (value: number) => {
  if (!Number.isFinite(value)) throw new DomainError('VALIDATION_ERROR', 'Money value must be finite')
  return Math.round(value * MONEY_SCALE)
}
const intToMoney = (value: number) => value / MONEY_SCALE
const roundMoney = (value: number) => Math.round(value * 100) / 100
const uid = () => randomUUID()

const migrations = [
  `
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      store_name TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      receipt_footer TEXT NOT NULL DEFAULT '',
      cashier TEXT NOT NULL DEFAULT 'Store manager',
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      sku TEXT NOT NULL COLLATE NOCASE UNIQUE,
      name_ar TEXT NOT NULL,
      name_en TEXT NOT NULL,
      category TEXT NOT NULL,
      unit TEXT NOT NULL CHECK (unit IN ('weight', 'piece')),
      price_milli INTEGER NOT NULL CHECK (price_milli >= 0),
      stock_base INTEGER NOT NULL CHECK (stock_base >= 0),
      avg_cost_milli INTEGER NOT NULL CHECK (avg_cost_milli >= 0),
      low_stock_base INTEGER NOT NULL CHECK (low_stock_base >= 0),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1))
    );
    CREATE TABLE IF NOT EXISTS product_packs (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id),
      grams INTEGER NOT NULL CHECK (grams > 0),
      price_milli INTEGER NOT NULL CHECK (price_milli >= 0),
      UNIQUE(product_id, grams, price_milli)
    );
    CREATE TABLE IF NOT EXISTS inventory_movements (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id),
      movement_type TEXT NOT NULL CHECK (movement_type IN ('opening', 'receive', 'sale', 'adjust')),
      quantity_base INTEGER NOT NULL,
      unit_cost_milli INTEGER NOT NULL CHECK (unit_cost_milli >= 0),
      balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
      note TEXT,
      reference TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      invoice_number TEXT NOT NULL UNIQUE,
      sale_date INTEGER NOT NULL,
      total_milli INTEGER NOT NULL,
      cash_milli INTEGER NOT NULL,
      change_milli INTEGER NOT NULL,
      cogs_milli INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sale_lines (
      id TEXT PRIMARY KEY,
      sale_id TEXT NOT NULL REFERENCES sales(id),
      product_id TEXT NOT NULL REFERENCES products(id),
      name_ar TEXT NOT NULL,
      name_en TEXT NOT NULL,
      unit TEXT NOT NULL CHECK (unit IN ('weight', 'piece')),
      mode TEXT NOT NULL CHECK (mode IN ('weight', 'piece', 'pack')),
      pack_grams INTEGER,
      item_count INTEGER NOT NULL,
      quantity_base INTEGER NOT NULL,
      unit_price_milli INTEGER NOT NULL,
      total_milli INTEGER NOT NULL,
      cost_milli INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_movements_product_date ON inventory_movements(product_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
    CREATE INDEX IF NOT EXISTS idx_sale_lines_product ON sale_lines(product_id);
    `,
  `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL COLLATE NOCASE UNIQUE,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'cashier')),
      active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      last_login_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_users_active ON users(active);
  `,
]

export class BazaarDatabase {
  readonly db: Database.Database
  readonly filePath: string

  constructor(filePath: string) {
    this.filePath = filePath
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    this.db = new Database(filePath)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')
    this.db.pragma('busy_timeout = 5000')
    this.migrate()
  }

  private migrate() {
    this.db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL)')
    const current = this.db.prepare('SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations').get() as { version: number }
    for (let version = current.version + 1; version <= migrations.length; version += 1) {
      const apply = this.db.transaction(() => {
        this.db.exec(migrations[version - 1])
        this.db.prepare('INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)').run(version, Date.now())
      })
      apply()
    }
    const settings = this.db.prepare('SELECT id FROM settings WHERE id = 1').get()
    if (!settings) {
      this.db.prepare('INSERT INTO settings(id, store_name, updated_at) VALUES (1, ?, ?)').run('Al-Gharbawy Bazaar', Date.now())
    }
    if (!this.db.prepare('SELECT value FROM app_meta WHERE key = ?').get('invoice_sequence')) {
      this.db.prepare('INSERT INTO app_meta(key, value) VALUES (?, ?)').run('invoice_sequence', '0')
    }
  }

  close() {
    this.db.close()
  }

  checkpoint() {
    this.db.pragma('wal_checkpoint(TRUNCATE)')
  }

  authStatus(): { configured: boolean } {
    const row = this.db.prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number }
    return { configured: row.count > 0 }
  }

  authenticate(username: string, password: string): UserSession {
    validateCredentials(username, password)
    const count = this.db.prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number }
    if (count.count === 0) {
      const now = Date.now()
      const user = this.createUser(username, password, 'admin', now)
      return sessionForUser(user)
    }
    const row = this.db.prepare('SELECT * FROM users WHERE username = ? AND active = 1').get(username.trim()) as UserRow | undefined
    if (!row || !verifyPassword(password, row.password_salt, row.password_hash)) throw new DomainError('AUTHENTICATION_ERROR', 'Incorrect username or password')
    this.db.prepare('UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?').run(Date.now(), Date.now(), row.id)
    return sessionForUser(row)
  }

  private createUser(username: string, password: string, role: UserRole, now = Date.now()): UserRow {
    validateCredentials(username, password)
    const credentials = hashPassword(password)
    const row: UserRow = { id: uid(), username: username.trim(), password_salt: credentials.salt, password_hash: credentials.hash, role, active: 1, created_at: now, updated_at: now, last_login_at: now }
    this.db.prepare('INSERT INTO users(id, username, password_salt, password_hash, role, active, created_at, updated_at, last_login_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)').run(row.id, row.username, row.password_salt, row.password_hash, row.role, now, now, now)
    return row
  }

  getState(): AppState {
    const products = this.db.prepare('SELECT * FROM products WHERE archived = 0 ORDER BY created_at DESC').all() as ProductRow[]
    const packs = this.db.prepare('SELECT * FROM product_packs').all() as PackRow[]
    const movements = this.db.prepare('SELECT * FROM inventory_movements ORDER BY created_at ASC').all() as MovementRow[]
    const sales = this.db.prepare('SELECT * FROM sales ORDER BY sale_date DESC').all() as SaleRow[]
    const lines = this.db.prepare('SELECT * FROM sale_lines').all() as SaleLineRow[]
    const settings = this.db.prepare('SELECT * FROM settings WHERE id = 1').get() as SettingsRow
    const seq = Number((this.db.prepare('SELECT value FROM app_meta WHERE key = ?').get('invoice_sequence') as { value: string }).value)

    return {
      products: products.map((p) => this.productFromRow(p, packs.filter((x) => x.product_id === p.id))),
      movements: movements.map((m) => ({ id: m.id, productId: m.product_id, type: m.movement_type, qty: m.quantity_base, unitCost: intToMoney(m.unit_cost_milli), balance: m.balance_after, date: m.created_at, note: m.note ?? undefined, ref: m.reference ?? undefined })),
      sales: sales.map((s) => ({ id: s.id, number: s.invoice_number, date: s.sale_date, total: intToMoney(s.total_milli), cash: intToMoney(s.cash_milli), change: intToMoney(s.change_milli), cogs: intToMoney(s.cogs_milli), lines: lines.filter((l) => l.sale_id === s.id).map(this.saleLineFromRow) })),
      settings: { storeName: settings.store_name, phone: settings.phone, address: settings.address, receiptFooter: settings.receipt_footer, cashier: settings.cashier },
      seq,
    }
  }

  saveProduct(input: ProductInput, opening?: { qty: number; cost: number }): Product {
    validateProduct(input)
    if (opening && (!Number.isInteger(opening.qty) || opening.qty < 0 || !Number.isFinite(opening.cost) || opening.cost < 0 || (opening.qty > 0 && opening.cost <= 0))) throw new DomainError('VALIDATION_ERROR', 'Invalid opening stock values')
    const now = Date.now()
    const existing = this.db.prepare('SELECT * FROM products WHERE id = ?').get(input.id) as ProductRow | undefined
    const duplicate = this.db.prepare('SELECT id FROM products WHERE sku = ? AND id <> ?').get(input.sku.trim(), input.id)
    if (duplicate) throw new DomainError('DUPLICATE_SKU', 'SKU already in use')

    const work = this.db.transaction(() => {
      if (existing) {
        this.db.prepare(`UPDATE products SET sku=?, name_ar=?, name_en=?, category=?, unit=?, price_milli=?, low_stock_base=?, updated_at=? WHERE id=?`).run(input.sku.trim(), input.nameAr.trim(), input.nameEn.trim(), input.category, input.unit, moneyToInt(input.price), Math.round(input.lowStock), now, input.id)
        this.db.prepare('DELETE FROM product_packs WHERE product_id = ?').run(input.id)
      } else {
        const qty = opening?.qty ?? 0
        const cost = opening?.cost ?? 0
        this.db.prepare(`INSERT INTO products(id, sku, name_ar, name_en, category, unit, price_milli, stock_base, avg_cost_milli, low_stock_base, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(input.id, input.sku.trim(), input.nameAr.trim(), input.nameEn.trim(), input.category, input.unit, moneyToInt(input.price), qty, moneyToInt(cost), Math.round(input.lowStock), input.createdAt ?? now, now)
        if (qty > 0) this.insertMovement(input.id, 'opening', qty, cost, qty, 'Opening stock', undefined, now)
      }
      const insertPack = this.db.prepare('INSERT INTO product_packs(id, product_id, grams, price_milli) VALUES (?, ?, ?, ?)')
      for (const pack of input.packs) insertPack.run(pack.id, input.id, pack.grams, moneyToInt(pack.price))
    })
    work()
    const row = this.db.prepare('SELECT * FROM products WHERE id = ?').get(input.id) as ProductRow
    return this.productFromRow(row, this.db.prepare('SELECT * FROM product_packs WHERE product_id = ?').all(input.id) as PackRow[])
  }

  archiveProduct(id: string) {
    const result = this.db.prepare('UPDATE products SET archived = 1, updated_at = ? WHERE id = ? AND archived = 0').run(Date.now(), id)
    if (!result.changes) throw new DomainError('NOT_FOUND', 'Product not found')
  }

  receive(productId: string, qty: number, cost: number, note: string) {
    if (!Number.isInteger(qty) || qty <= 0 || !Number.isFinite(cost) || cost <= 0) throw new DomainError('VALIDATION_ERROR', 'Invalid receiving values')
    const work = this.db.transaction(() => {
      const p = this.getProductRow(productId)
      const factor = p.unit === 'weight' ? 1000 : 1
      const oldUnits = p.stock_base / factor
      const addedUnits = qty / factor
      const newCost = Math.round(((oldUnits * p.avg_cost_milli) + (addedUnits * moneyToInt(cost))) / (oldUnits + addedUnits))
      const balance = p.stock_base + qty
      this.db.prepare('UPDATE products SET stock_base = ?, avg_cost_milli = ?, updated_at = ? WHERE id = ?').run(balance, newCost, Date.now(), productId)
      this.insertMovement(productId, 'receive', qty, cost, balance, note)
    })
    work()
  }

  adjust(productId: string, delta: number, note: string) {
    if (!Number.isInteger(delta) || delta === 0) throw new DomainError('VALIDATION_ERROR', 'Adjustment quantity must be a non-zero integer')
    const work = this.db.transaction(() => {
      const p = this.getProductRow(productId)
      const balance = p.stock_base + delta
      if (balance < 0) throw new DomainError('INSUFFICIENT_STOCK', 'Stock cannot go negative', { available: p.stock_base })
      this.db.prepare('UPDATE products SET stock_base = ?, updated_at = ? WHERE id = ?').run(balance, Date.now(), productId)
      this.insertMovement(productId, 'adjust', delta, intToMoney(p.avg_cost_milli), balance, note)
    })
    work()
  }

  checkout(cart: CartLine[], cash: number): { ok: true; sale: Sale } | { ok: false; error: string } {
    try {
      if (!cart.length || !Number.isFinite(cash) || cash < 0) throw new DomainError('VALIDATION_ERROR', 'Invalid sale')
      const result = this.db.transaction(() => {
        const products = new Map<string, ProductRow>()
        const packs = new Map<string, PackRow[]>()
        for (const line of cart) {
          products.set(line.productId, this.getProductRow(line.productId))
          packs.set(line.productId, this.db.prepare('SELECT * FROM product_packs WHERE product_id = ?').all(line.productId) as PackRow[])
        }
        const required = new Map<string, number>()
        const lines: SaleLine[] = []
        for (const line of cart) {
          const p = products.get(line.productId)!
          const info = lineInfo(p, packs.get(p.id) ?? [], line)
          required.set(p.id, (required.get(p.id) ?? 0) + info.base)
          lines.push({ productId: p.id, nameAr: p.name_ar, nameEn: p.name_en, unit: p.unit, mode: line.mode, packGrams: info.packGrams, count: line.mode === 'weight' ? 1 : line.qty, qty: info.base, unitPrice: info.unitPrice, total: info.total, cost: roundMoney(info.base * intToMoney(p.avg_cost_milli) / (p.unit === 'weight' ? 1000 : 1)) })
        }
        for (const [id, qty] of required) {
          const p = products.get(id)!
          if (qty > p.stock_base) throw new DomainError('INSUFFICIENT_STOCK', `Insufficient stock: ${p.name_en}`)
        }
        const total = roundMoney(lines.reduce((sum, line) => sum + line.total, 0))
        if (cash < total) throw new DomainError('VALIDATION_ERROR', 'Cash received is less than total')
        const nextSeq = Number((this.db.prepare('SELECT value FROM app_meta WHERE key = ?').get('invoice_sequence') as { value: string }).value) + 1
        const sale: Sale = { id: uid(), number: `INV-${nextSeq}`, date: Date.now(), lines, total, cash, change: roundMoney(cash - total), cogs: roundMoney(lines.reduce((sum, line) => sum + line.cost, 0)) }
        this.db.prepare('UPDATE app_meta SET value = ? WHERE key = ?').run(String(nextSeq), 'invoice_sequence')
        this.db.prepare('INSERT INTO sales(id, invoice_number, sale_date, total_milli, cash_milli, change_milli, cogs_milli) VALUES (?, ?, ?, ?, ?, ?, ?)').run(sale.id, sale.number, sale.date, moneyToInt(sale.total), moneyToInt(sale.cash), moneyToInt(sale.change), moneyToInt(sale.cogs))
        const addLine = this.db.prepare('INSERT INTO sale_lines(id, sale_id, product_id, name_ar, name_en, unit, mode, pack_grams, item_count, quantity_base, unit_price_milli, total_milli, cost_milli) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        for (const line of lines) addLine.run(uid(), sale.id, line.productId, line.nameAr, line.nameEn, line.unit, line.mode, line.packGrams ?? null, line.count, line.qty, moneyToInt(line.unitPrice), moneyToInt(line.total), moneyToInt(line.cost))
        for (const [id, qty] of required) {
          const p = products.get(id)!
          const balance = p.stock_base - qty
          this.db.prepare('UPDATE products SET stock_base = ?, updated_at = ? WHERE id = ?').run(balance, sale.date, id)
          this.insertMovement(id, 'sale', -qty, intToMoney(p.avg_cost_milli), balance, undefined, sale.number, sale.date)
        }
        return sale
      })()
      return { ok: true, sale: result }
    } catch (error) {
      if (error instanceof DomainError) return { ok: false, error: error.message }
      throw error
    }
  }

  saveSettings(settings: Settings) {
    this.db.prepare('UPDATE settings SET store_name=?, phone=?, address=?, receipt_footer=?, cashier=?, updated_at=? WHERE id=1').run(settings.storeName.trim(), settings.phone, settings.address, settings.receiptFooter, settings.cashier.trim(), Date.now())
  }

  restore(state: AppState) {
    if (!state || !Array.isArray(state.products) || !Array.isArray(state.movements) || !Array.isArray(state.sales) || !state.settings) throw new DomainError('VALIDATION_ERROR', 'Invalid backup data')
    const work = this.db.transaction(() => {
      this.db.exec('DELETE FROM sale_lines; DELETE FROM sales; DELETE FROM inventory_movements; DELETE FROM product_packs; DELETE FROM products;')
      this.db.prepare('UPDATE settings SET store_name=?, phone=?, address=?, receipt_footer=?, cashier=?, updated_at=? WHERE id=1').run(state.settings.storeName, state.settings.phone, state.settings.address, state.settings.receiptFooter, state.settings.cashier, Date.now())
      this.db.prepare('UPDATE app_meta SET value = ? WHERE key = ?').run(String(state.seq), 'invoice_sequence')
      const addProduct = this.db.prepare('INSERT INTO products(id, sku, name_ar, name_en, category, unit, price_milli, stock_base, avg_cost_milli, low_stock_base, created_at, updated_at, archived) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)')
      const addPack = this.db.prepare('INSERT INTO product_packs(id, product_id, grams, price_milli) VALUES (?, ?, ?, ?)')
      for (const product of state.products) {
        validateProduct(product)
        addProduct.run(product.id, product.sku, product.nameAr, product.nameEn, product.category, product.unit, moneyToInt(product.price), product.stock, moneyToInt(product.avgCost), product.lowStock, product.createdAt, Date.now())
        for (const pack of product.packs) addPack.run(pack.id, product.id, pack.grams, moneyToInt(pack.price))
      }
      const addMovement = this.db.prepare('INSERT INTO inventory_movements(id, product_id, movement_type, quantity_base, unit_cost_milli, balance_after, note, reference, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      for (const movement of state.movements) addMovement.run(movement.id, movement.productId, movement.type, movement.qty, moneyToInt(movement.unitCost), movement.balance, movement.note ?? null, movement.ref ?? null, movement.date)
      const addSale = this.db.prepare('INSERT INTO sales(id, invoice_number, sale_date, total_milli, cash_milli, change_milli, cogs_milli) VALUES (?, ?, ?, ?, ?, ?, ?)')
      const addLine = this.db.prepare('INSERT INTO sale_lines(id, sale_id, product_id, name_ar, name_en, unit, mode, pack_grams, item_count, quantity_base, unit_price_milli, total_milli, cost_milli) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      for (const sale of state.sales) {
        addSale.run(sale.id, sale.number, sale.date, moneyToInt(sale.total), moneyToInt(sale.cash), moneyToInt(sale.change), moneyToInt(sale.cogs))
        for (const line of sale.lines) addLine.run(uid(), sale.id, line.productId, line.nameAr, line.nameEn, line.unit, line.mode, line.packGrams ?? null, line.count, line.qty, moneyToInt(line.unitPrice), moneyToInt(line.total), moneyToInt(line.cost))
      }
    })
    work()
  }

  reset() {
    const work = this.db.transaction(() => {
      this.db.exec('DELETE FROM sale_lines; DELETE FROM sales; DELETE FROM inventory_movements; DELETE FROM product_packs; DELETE FROM products;')
      this.db.prepare('UPDATE app_meta SET value = ? WHERE key = ?').run('0', 'invoice_sequence')
    })
    work()
  }

  private getProductRow(id: string) {
    const row = this.db.prepare('SELECT * FROM products WHERE id = ? AND archived = 0').get(id) as ProductRow | undefined
    if (!row) throw new DomainError('NOT_FOUND', 'Product not found')
    return row
  }

  private insertMovement(productId: string, type: Movement['type'], qty: number, unitCost: number, balance: number, note?: string, ref?: string, date = Date.now()) {
    this.db.prepare('INSERT INTO inventory_movements(id, product_id, movement_type, quantity_base, unit_cost_milli, balance_after, note, reference, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(uid(), productId, type, qty, moneyToInt(unitCost), balance, note ?? null, ref ?? null, date)
  }

  private productFromRow(row: ProductRow, packRows: PackRow[]): Product {
    return { id: row.id, sku: row.sku, nameAr: row.name_ar, nameEn: row.name_en, category: row.category, unit: row.unit, price: intToMoney(row.price_milli), stock: row.stock_base, avgCost: intToMoney(row.avg_cost_milli), lowStock: row.low_stock_base, packs: packRows.map((p) => ({ id: p.id, grams: p.grams, price: intToMoney(p.price_milli) })), createdAt: row.created_at, archived: Boolean(row.archived) }
  }

  private saleLineFromRow(row: SaleLineRow): SaleLine {
    return { productId: row.product_id, nameAr: row.name_ar, nameEn: row.name_en, unit: row.unit, mode: row.mode, packGrams: row.pack_grams ?? undefined, count: row.item_count, qty: row.quantity_base, unitPrice: intToMoney(row.unit_price_milli), total: intToMoney(row.total_milli), cost: intToMoney(row.cost_milli) }
  }
}

type ProductRow = { id: string; sku: string; name_ar: string; name_en: string; category: string; unit: Unit; price_milli: number; stock_base: number; avg_cost_milli: number; low_stock_base: number; created_at: number; archived: number }
type PackRow = { id: string; product_id: string; grams: number; price_milli: number }
type MovementRow = { id: string; product_id: string; movement_type: Movement['type']; quantity_base: number; unit_cost_milli: number; balance_after: number; note: string | null; reference: string | null; created_at: number }
type SettingsRow = { store_name: string; phone: string; address: string; receipt_footer: string; cashier: string }
type SaleRow = { id: string; invoice_number: string; sale_date: number; total_milli: number; cash_milli: number; change_milli: number; cogs_milli: number }
type SaleLineRow = { sale_id: string; product_id: string; name_ar: string; name_en: string; unit: Unit; mode: SaleLine['mode']; pack_grams: number | null; item_count: number; quantity_base: number; unit_price_milli: number; total_milli: number; cost_milli: number }
type UserRow = { id: string; username: string; password_salt: string; password_hash: string; role: UserRole; active: number; created_at: number; updated_at: number; last_login_at: number | null }

function validateProduct(product: ProductInput) {
  if (!product.id || !product.sku.trim() || !product.nameAr.trim() || !product.nameEn.trim() || !product.category) throw new DomainError('VALIDATION_ERROR', 'Product names, SKU, and category are required')
  if (!Number.isFinite(product.price) || product.price <= 0) throw new DomainError('VALIDATION_ERROR', 'Product price must be above zero')
  if (!Number.isInteger(product.lowStock) || product.lowStock < 0) throw new DomainError('VALIDATION_ERROR', 'Low-stock threshold must be a whole base-unit quantity')
  if (product.unit === 'piece' && product.packs.length) throw new DomainError('VALIDATION_ERROR', 'Piece products cannot have weight packs')
  for (const pack of product.packs) if (!Number.isInteger(pack.grams) || pack.grams <= 0 || !Number.isFinite(pack.price) || pack.price <= 0) throw new DomainError('VALIDATION_ERROR', 'Pack weight and price must be valid')
}

export const permissionsForRole = (role: UserRole): Permission[] => {
  if (role === 'admin') return ['sell', 'viewSales', 'manageProducts', 'manageInventory', 'viewReports', 'manageSettings', 'manageBackups', 'manageUsers']
  if (role === 'manager') return ['sell', 'viewSales', 'manageProducts', 'manageInventory', 'viewReports', 'manageSettings', 'manageBackups']
  return ['sell', 'viewSales']
}

function validateCredentials(username: string, password: string) {
  if (!/^[\p{L}\p{N}._-]{3,64}$/u.test(username.trim())) throw new DomainError('VALIDATION_ERROR', 'Username must be 3-64 letters, numbers, dots, underscores, or hyphens')
  if (password.length < 8 || password.length > 128) throw new DomainError('VALIDATION_ERROR', 'Password must be 8-128 characters')
}

function hashPassword(password: string) {
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, 64)
  return { salt: salt.toString('base64'), hash: hash.toString('base64') }
}

function verifyPassword(password: string, saltBase64: string, hashBase64: string) {
  const expected = Buffer.from(hashBase64, 'base64')
  const actual = scryptSync(password, Buffer.from(saltBase64, 'base64'), expected.length)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

function sessionForUser(user: Pick<UserRow, 'id' | 'username' | 'role'>): UserSession {
  return { id: user.id, username: user.username, role: user.role, permissions: permissionsForRole(user.role) }
}

function lineInfo(product: ProductRow, productPacks: PackRow[], line: CartLine) {
  if (!Number.isInteger(line.qty) || line.qty <= 0) throw new DomainError('VALIDATION_ERROR', 'Cart quantity must be a positive whole base-unit value')
  if (product.unit === 'piece' && line.mode !== 'piece') throw new DomainError('INVALID_OPERATION', 'Piece products can only be sold by piece')
  if (product.unit === 'weight' && line.mode === 'piece') throw new DomainError('INVALID_OPERATION', 'Weight products cannot be sold as pieces')
  if (line.mode === 'weight') return { base: line.qty, unitPrice: intToMoney(product.price_milli), total: roundMoney((line.qty / 1000) * intToMoney(product.price_milli)), packGrams: undefined }
  if (line.mode === 'pack') {
    if (product.unit !== 'weight') throw new DomainError('INVALID_OPERATION', 'Packs require a weight product')
    const pack = productPacks.find((candidate) => candidate.id === line.packId)
    if (!pack) throw new DomainError('INVALID_OPERATION', 'Pack definition not found')
    return { base: pack.grams * line.qty, unitPrice: intToMoney(pack.price_milli), total: roundMoney(intToMoney(pack.price_milli) * line.qty), packGrams: pack.grams }
  }
  return { base: line.qty, unitPrice: intToMoney(product.price_milli), total: roundMoney(intToMoney(product.price_milli) * line.qty), packGrams: undefined }
}
