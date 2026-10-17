import { app, BrowserWindow, ipcMain, session } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { BazaarDatabase, DomainError } from './database.js'
import { BazaarService } from './service.js'
import type { ElectronApi } from '../shared/contracts.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isDev = !app.isPackaged
const devUrl = `http://localhost:${process.env.PORT || '8443'}`
let database: BazaarDatabase | undefined
let service: BazaarService | undefined

function registerIpc() {
  const invoke = <K extends keyof Omit<ElectronApi, 'platform'>>(name: K, handler: (...args: any[]) => unknown) => {
    ipcMain.handle(name, async (_event, ...args) => {
      try {
        return await handler(...args)
      } catch (error) {
        if (error instanceof DomainError) throw { code: error.code, message: error.message, details: error.details }
        console.error(`IPC ${String(name)} failed`, error)
        throw { code: 'DATABASE_ERROR', message: 'The local database operation failed' }
      }
    })
  }

  invoke('getState', () => service!.getState())
  invoke('saveProduct', (product, opening) => service!.saveProduct(product, opening))
  invoke('archiveProduct', (id) => service!.archiveProduct(id))
  invoke('receive', (productId, qty, cost, note) => service!.receive(productId, qty, cost, note))
  invoke('adjust', (productId, delta, note) => service!.adjust(productId, delta, note))
  invoke('checkout', (cart, cash) => service!.checkout(cart, cash))
  invoke('saveSettings', (settings) => service!.saveSettings(settings))
  invoke('restore', (state) => service!.restore(state))
  invoke('reset', () => service!.reset())
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1024,
    minHeight: 720,
    backgroundColor: '#f7f3ea',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ["default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; script-src 'self' 'unsafe-eval'; img-src 'self' data:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' http://localhost:8443 ws://localhost:8443"],
      },
    })
  })

  if (isDev) await win.loadURL(devUrl)
  else await win.loadFile(path.join(__dirname, '../../dist/index.html'))
}

app.whenReady().then(async () => {
  const databasePath = path.join(app.getPath('userData'), 'data', 'al-gharbawy-bazaar.sqlite')
  database = new BazaarDatabase(databasePath)
  service = new BazaarService(database)
  registerIpc()
  await createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) void createWindow() })
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('before-quit', () => database?.close())
