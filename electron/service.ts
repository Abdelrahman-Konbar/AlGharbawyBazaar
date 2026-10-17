import type { BazaarDatabase } from './database.js'
import type { AppState, CartLine, ProductInput, Settings } from '../shared/contracts.js'

/** Application service boundary used by Electron IPC. The database class owns
 * persistence and transactions; this class is the only application-facing API. */
export class BazaarService {
  constructor(private readonly repository: BazaarDatabase) {}

  getState() { return this.repository.getState() }
  saveProduct(product: ProductInput, opening?: { qty: number; cost: number }) { return this.repository.saveProduct(product, opening) }
  archiveProduct(id: string) { return this.repository.archiveProduct(id) }
  receive(productId: string, qty: number, cost: number, note: string) { return this.repository.receive(productId, qty, cost, note) }
  adjust(productId: string, delta: number, note: string) { return this.repository.adjust(productId, delta, note) }
  checkout(cart: CartLine[], cash: number) { return this.repository.checkout(cart, cash) }
  saveSettings(settings: Settings) { return this.repository.saveSettings(settings) }
  restore(state: AppState) { return this.repository.restore(state) }
  reset() { return this.repository.reset() }
}
