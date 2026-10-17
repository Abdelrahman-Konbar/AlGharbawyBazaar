export type Lang = 'ar' | 'en'
export type Unit = 'weight' | 'piece'
export type MoveType = 'opening' | 'receive' | 'sale' | 'adjust'

export interface Pack {
  id: string
  grams: number
  price: number
}

export interface Product {
  id: string
  sku: string
  nameAr: string
  nameEn: string
  category: string
  unit: Unit
  price: number
  stock: number
  avgCost: number
  lowStock: number
  packs: Pack[]
  createdAt: number
  archived?: boolean
}

export interface Movement {
  id: string
  productId: string
  type: MoveType
  qty: number
  unitCost: number
  balance: number
  date: number
  note?: string
  ref?: string
}

export interface SaleLine {
  productId: string
  nameAr: string
  nameEn: string
  unit: Unit
  mode: 'weight' | 'piece' | 'pack'
  packGrams?: number
  count: number
  qty: number
  unitPrice: number
  total: number
  cost: number
}

export interface Sale {
  id: string
  number: string
  date: number
  lines: SaleLine[]
  total: number
  cash: number
  change: number
  cogs: number
}

export interface Settings {
  storeName: string
  phone: string
  address: string
  receiptFooter: string
  cashier: string
}

export interface AppState {
  products: Product[]
  movements: Movement[]
  sales: Sale[]
  settings: Settings
  seq: number
}

export interface CartLine {
  key: string
  productId: string
  mode: 'weight' | 'piece' | 'pack'
  packId?: string
  qty: number
}

export interface ProductInput {
  id: string
  sku: string
  nameAr: string
  nameEn: string
  category: string
  unit: Unit
  price: number
  lowStock: number
  packs: Pack[]
  createdAt?: number
}

export type DomainErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'DUPLICATE_SKU'
  | 'INSUFFICIENT_STOCK'
  | 'INVALID_OPERATION'
  | 'DATABASE_ERROR'

export interface DomainErrorShape {
  code: DomainErrorCode
  message: string
  details?: Record<string, unknown>
}

export interface ProductServiceApi {
  getState(): Promise<AppState>
  saveProduct(product: ProductInput, opening?: { qty: number; cost: number }): Promise<Product>
  archiveProduct(id: string): Promise<void>
  receive(productId: string, qty: number, cost: number, note: string): Promise<void>
  adjust(productId: string, delta: number, note: string): Promise<void>
  checkout(cart: CartLine[], cash: number): Promise<{ ok: true; sale: Sale } | { ok: false; error: string }>
  saveSettings(settings: Settings): Promise<void>
  restore(state: AppState): Promise<void>
  reset(): Promise<void>
}

export interface ElectronApi extends ProductServiceApi {
  platform: 'win32' | 'darwin' | 'linux'
}
