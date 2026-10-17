import { contextBridge, ipcRenderer } from 'electron'
import type { ElectronApi } from '../shared/contracts.js'

const channels: Array<keyof Omit<ElectronApi, 'platform'>> = [
  'authStatus',
  'login',
  'logout',
  'getState',
  'saveProduct',
  'archiveProduct',
  'receive',
  'adjust',
  'checkout',
  'saveSettings',
  'restore',
  'reset',
  'getBackupStatus',
  'createBackup',
  'restoreBackupFromDialog',
]

const api: ElectronApi = {
  platform: process.platform as ElectronApi['platform'],
  authStatus: () => ipcRenderer.invoke('authStatus'),
  login: (username, password) => ipcRenderer.invoke('login', username, password),
  logout: () => ipcRenderer.invoke('logout'),
  getState: () => ipcRenderer.invoke('getState'),
  saveProduct: (product, opening) => ipcRenderer.invoke('saveProduct', product, opening),
  archiveProduct: (id) => ipcRenderer.invoke('archiveProduct', id),
  receive: (productId, qty, cost, note) => ipcRenderer.invoke('receive', productId, qty, cost, note),
  adjust: (productId, delta, note) => ipcRenderer.invoke('adjust', productId, delta, note),
  checkout: (cart, cash) => ipcRenderer.invoke('checkout', cart, cash),
  saveSettings: (settings) => ipcRenderer.invoke('saveSettings', settings),
  restore: (state) => ipcRenderer.invoke('restore', state),
  reset: () => ipcRenderer.invoke('reset'),
  getBackupStatus: () => ipcRenderer.invoke('getBackupStatus'),
  createBackup: () => ipcRenderer.invoke('createBackup'),
  restoreBackupFromDialog: () => ipcRenderer.invoke('restoreBackupFromDialog'),
}

for (const channel of channels) {
  if (!(channel in api)) throw new Error(`Missing IPC bridge handler: ${String(channel)}`)
}

contextBridge.exposeInMainWorld('electronAPI', api)
