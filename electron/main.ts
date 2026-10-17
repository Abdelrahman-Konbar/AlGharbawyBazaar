import { app, BrowserWindow, dialog, ipcMain, session } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomBytes } from 'node:crypto'
import { BazaarDatabase, DomainError, permissionsForRole } from './database.js'
import { BazaarService } from './service.js'
import { BackupManager } from './backup.js'
import type { ElectronApi, Permission, UserSession } from '../shared/contracts.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isDev = !app.isPackaged
const devUrl = `http://localhost:${process.env.PORT || '8443'}`
let database: BazaarDatabase | undefined
let service: BazaarService | undefined
let backupManager: BackupManager | undefined
let databasePath = ''
const sessions = new Map<number, { token: string; session: UserSession; lastSeen: number }>()

function registerIpc() {
  const invoke = <K extends keyof Omit<ElectronApi, 'platform'>>(name: K, permission: Permission | null, handler: (...args: any[]) => unknown) => {
    ipcMain.handle(name, async (event, ...args) => {
      try {
        if (permission) requirePermission(event.sender.id, permission)
        return await handler(...args)
      } catch (error) {
        if (error instanceof DomainError) throw { code: error.code, message: error.message, details: error.details }
        console.error(`IPC ${String(name)} failed`, error)
        throw { code: 'DATABASE_ERROR', message: 'The local database operation failed' }
      }
    })
  }

  ipcMain.handle('authStatus', (event) => ({ ...database!.authStatus(), session: sessions.get(event.sender.id)?.session ?? null }))
  ipcMain.handle('login', async (event, username: string, password: string) => {
    try {
      const session = database!.authenticate(username, password)
      sessions.set(event.sender.id, { token: randomToken(), session, lastSeen: Date.now() })
      return session
    } catch (error) {
      if (error instanceof DomainError) throw { code: error.code, message: error.message, details: error.details }
      throw { code: 'AUTHENTICATION_ERROR', message: 'Authentication failed' }
    }
  })
  ipcMain.handle('logout', (event) => { sessions.delete(event.sender.id) })

  invoke('getState', 'viewSales', () => service!.getState())
  invoke('saveProduct', 'manageProducts', (product, opening) => service!.saveProduct(product, opening))
  invoke('archiveProduct', 'manageProducts', (id) => service!.archiveProduct(id))
  invoke('receive', 'manageInventory', (productId, qty, cost, note) => service!.receive(productId, qty, cost, note))
  invoke('adjust', 'manageInventory', (productId, delta, note) => service!.adjust(productId, delta, note))
  invoke('checkout', 'sell', (cart, cash) => service!.checkout(cart, cash))
  invoke('saveSettings', 'manageSettings', (settings) => service!.saveSettings(settings))
  invoke('restore', 'manageBackups', (state) => service!.restore(state))
  invoke('reset', 'manageBackups', () => service!.reset())
  invoke('getBackupStatus', 'viewSales', () => backupManager!.getStatus())
  invoke('createBackup', 'manageBackups', () => backupManager!.createBackup('manual'))
  invoke('restoreBackupFromDialog', 'manageBackups', restoreBackupFromDialog)
}

function randomToken() {
  return randomBytes(32).toString('base64url')
}

function requirePermission(senderId: number, permission: Permission) {
  const current = sessions.get(senderId)
  if (!current) throw new DomainError('AUTHENTICATION_ERROR', 'Sign-in required')
  current.lastSeen = Date.now()
  if (!permissionsForRole(current.session.role).includes(permission)) throw new DomainError('AUTHORIZATION_ERROR', 'You are not allowed to perform this action')
}

async function restoreBackupFromDialog() {
  const selected = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'SQLite backup', extensions: ['sqlite'] }] })
  if (selected.canceled || !selected.filePaths[0]) return { restored: false }
  const source = selected.filePaths[0]
  backupManager!.validateBackup(source)
  const safety = await backupManager!.createBackup('pre-restore')
  database!.close()
  try {
    fs.copyFileSync(source, databasePath)
    database = new BazaarDatabase(databasePath)
    service = new BazaarService(database)
    return { restored: true, path: source }
  } catch (error) {
    try { fs.copyFileSync(safety.path, databasePath) } catch { /* preserve original error */ }
    database = new BazaarDatabase(databasePath)
    service = new BazaarService(database)
    throw error
  }
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
        'Content-Security-Policy': ["default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-eval'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' http://localhost:8443 ws://localhost:8443"],
      },
    })
  })

  if (isDev) await win.loadURL(devUrl)
  else await win.loadFile(path.join(__dirname, '../../dist/index.html'))
}

app.whenReady().then(async () => {
  databasePath = path.join(app.getPath('userData'), 'data', 'al-gharbawy-bazaar.sqlite')
  database = new BazaarDatabase(databasePath)
  service = new BazaarService(database)
  backupManager = new BackupManager(path.join(app.getPath('userData'), 'backups'), () => database)
  registerIpc()
  void backupManager.runIfDue()
  setInterval(() => void backupManager?.runIfDue(), 15 * 60 * 1000)
  await createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) void createWindow() })
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('before-quit', () => database?.close())
