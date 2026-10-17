import { contextBridge, ipcRenderer } from 'electron'
import type { ElectronApi } from '../shared/contracts.js'

const channels: Array<keyof Omit<ElectronApi, 'platform'>> = [
  'getState',
  'saveProduct',
  'archiveProduct',
  'receive',
  'adjust',
  'checkout',
  'saveSettings',
  'restore',
  'reset',
]

const api: ElectronApi = {
  platform: process.platform as ElectronApi['platform'],
  getState: () => ipcRenderer.invoke('getState'),
  saveProduct: (product, opening) => ipcRenderer.invoke('saveProduct', product, opening),
  archiveProduct: (id) => ipcRenderer.invoke('archiveProduct', id),
  receive: (productId, qty, cost, note) => ipcRenderer.invoke('receive', productId, qty, cost, note),
  adjust: (productId, delta, note) => ipcRenderer.invoke('adjust', productId, delta, note),
  checkout: (cart, cash) => ipcRenderer.invoke('checkout', cart, cash),
  saveSettings: (settings) => ipcRenderer.invoke('saveSettings', settings),
  restore: (state) => ipcRenderer.invoke('restore', state),
  reset: () => ipcRenderer.invoke('reset'),
}

for (const channel of channels) {
  if (!(channel in api)) throw new Error(`Missing IPC bridge handler: ${String(channel)}`)
}

contextBridge.exposeInMainWorld('electronAPI', api)
