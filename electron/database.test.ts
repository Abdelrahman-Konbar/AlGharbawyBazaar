import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { CartLine, ProductInput } from '../shared/contracts.js'
import { BazaarDatabase } from './database.js'

const files: string[] = []
const open = () => {
  const file = path.join(os.tmpdir(), `al-gharbawy-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`)
  files.push(file)
  return new BazaarDatabase(file)
}
const product: ProductInput = {
  id: 'P-1', sku: 'GB-001', nameAr: 'كاجو', nameEn: 'Cashews', category: 'nuts', unit: 'weight', price: 300, lowStock: 500, packs: [{ id: 'pack-250', grams: 250, price: 80 }],
}

afterEach(() => {
  for (const file of files.splice(0)) {
    for (const suffix of ['', '-wal', '-shm']) fs.rmSync(file + suffix, { force: true })
  }
})

describe('BazaarDatabase', () => {
  it('runs versioned migrations and starts without demo data', () => {
    const db = open()
    expect((db.db.prepare('SELECT MAX(version) AS version FROM schema_migrations').get() as { version: number }).version).toBe(1)
    expect(db.getState().products).toHaveLength(0)
    db.close()
  })

  it('persists product creation, packs, and opening stock', () => {
    const db = open()
    db.saveProduct(product, { qty: 2000, cost: 120 })
    const state = db.getState()
    expect(state.products[0]).toMatchObject({ id: 'P-1', stock: 2000, avgCost: 120 })
    expect(state.products[0].packs).toEqual([{ id: 'pack-250', grams: 250, price: 80 }])
    expect(state.movements[0]).toMatchObject({ type: 'opening', qty: 2000 })
    db.close()
    const reopened = new BazaarDatabase(files[files.length - 1])
    expect(reopened.getState().products[0].sku).toBe('GB-001')
    reopened.close()
  })

  it('calculates moving weighted-average cost using grams as the base unit', () => {
    const db = open()
    db.saveProduct(product, { qty: 1000, cost: 100 })
    db.receive('P-1', 1000, 200, 'Supplier')
    expect(db.getState().products[0].avgCost).toBe(150)
    expect(db.getState().products[0].stock).toBe(2000)
    db.close()
  })

  it('updates product definitions without changing stock or historical movements', () => {
    const db = open()
    db.saveProduct(product, { qty: 1000, cost: 100 })
    db.saveProduct({ ...product, nameEn: 'Premium Cashews', price: 350, lowStock: 750, packs: [{ id: 'pack-500', grams: 500, price: 170 }] })
    expect(db.getState().products[0]).toMatchObject({ nameEn: 'Premium Cashews', price: 350, stock: 1000, avgCost: 100, lowStock: 750 })
    expect(db.getState().products[0].packs).toEqual([{ id: 'pack-500', grams: 500, price: 170 }])
    expect(db.getState().movements).toHaveLength(1)
    db.close()
  })

  it('prevents negative stock and rolls back rejected adjustments', () => {
    const db = open()
    db.saveProduct({ ...product, packs: [] }, { qty: 500, cost: 100 })
    expect(() => db.adjust('P-1', -501, 'Damage')).toThrow()
    expect(db.getState().products[0].stock).toBe(500)
    expect(db.getState().movements).toHaveLength(1)
    db.close()
  })

  it('archives products without deleting historical movement rows', () => {
    const db = open()
    db.saveProduct({ ...product, packs: [] }, { qty: 500, cost: 100 })
    db.archiveProduct('P-1')
    expect(db.getState().products).toHaveLength(0)
    expect((db.db.prepare('SELECT COUNT(*) AS count FROM inventory_movements').get() as { count: number }).count).toBe(1)
    expect((db.db.prepare('SELECT archived FROM products WHERE id = ?').get('P-1') as { archived: number }).archived).toBe(1)
    db.close()
  })

  it('commits a pack sale atomically and rolls back insufficient sales', () => {
    const db = open()
    db.saveProduct(product, { qty: 500, cost: 100 })
    const cart: CartLine[] = [{ key: 'line-1', productId: 'P-1', mode: 'pack', packId: 'pack-250', qty: 2 }]
    const sale = db.checkout(cart, 200)
    expect(sale.ok).toBe(true)
    expect(db.getState().products[0].stock).toBe(0)
    expect(db.getState().sales[0].lines[0]).toMatchObject({ qty: 500, total: 160 })
    const rejected = db.checkout(cart, 200)
    expect(rejected).toMatchObject({ ok: false })
    expect(db.getState().sales).toHaveLength(1)
    expect(db.getState().movements.filter((movement) => movement.type === 'sale')).toHaveLength(1)
    db.close()
  })

  it('keeps piece quantities as whole units', () => {
    const db = open()
    db.saveProduct({ id: 'P-2', sku: 'GB-002', nameAr: 'علبة', nameEn: 'Box', category: 'snacks', unit: 'piece', price: 50, lowStock: 2, packs: [] }, { qty: 3, cost: 30 })
    const result = db.checkout([{ key: 'piece', productId: 'P-2', mode: 'piece', qty: 2 }], 100)
    expect(result.ok).toBe(true)
    expect(db.getState().products[0].stock).toBe(1)
    expect(db.getState().sales[0].lines[0].qty).toBe(2)
    db.close()
  })
})
