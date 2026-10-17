import Database from 'better-sqlite3'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type { BackupResult, BackupStatus } from '../shared/contracts.js'
import type { BazaarDatabase } from './database.js'

const STATUS_FILE = 'backup-status.json'

export class BackupManager {
  private status: BackupStatus

  constructor(private readonly directory: string, private readonly getDatabase: () => BazaarDatabase | undefined) {
    fs.mkdirSync(directory, { recursive: true })
    this.status = this.readStatus()
  }

  getStatus(): BackupStatus { return { ...this.status } }

  async createBackup(reason: 'manual' | 'scheduled' | 'pre-restore' = 'manual'): Promise<BackupResult> {
    const database = this.getDatabase()
    if (!database) throw new Error('Database is not ready')
    fs.mkdirSync(this.directory, { recursive: true })
    database.checkpoint()
    const createdAt = Date.now()
    const stem = `al-gharbawy-${new Date(createdAt).toISOString().replace(/[:.]/g, '-')}-${reason}`
    const temporary = path.join(this.directory, `${stem}.sqlite.tmp`)
    const destination = path.join(this.directory, `${stem}.sqlite`)
    fs.copyFileSync(database.filePath, temporary)
    const handle = fs.openSync(temporary, 'r+')
    try { fs.fsyncSync(handle) } finally { fs.closeSync(handle) }
    fs.renameSync(temporary, destination)
    const result: BackupResult = { path: destination, createdAt, size: fs.statSync(destination).size, checksum: checksum(destination) }
    fs.writeFileSync(`${destination}.json`, JSON.stringify({ version: 1, reason, ...result }, null, 2), 'utf8')
    this.status = { enabled: true, directory: this.directory, lastBackupAt: result.createdAt, lastBackupPath: result.path, lastError: null }
    this.writeStatus()
    return result
  }

  validateBackup(filePath: string) {
    if (!fs.existsSync(filePath) || fs.statSync(filePath).size < 4096) throw new Error('Backup file is missing or empty')
    const backup = new Database(filePath, { readonly: true, fileMustExist: true })
    try {
      const integrity = backup.prepare('PRAGMA integrity_check').get() as { integrity_check: string }
      if (integrity.integrity_check !== 'ok') throw new Error('SQLite integrity check failed')
      const schema = backup.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('products', 'inventory_movements', 'sales', 'sale_lines', 'settings')").all() as Array<{ name: string }>
      if (schema.length !== 5) throw new Error('Backup schema is incomplete')
      const manifestPath = `${filePath}.json`
      if (fs.existsSync(manifestPath)) {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { checksum?: string }
        if (manifest.checksum && manifest.checksum !== checksum(filePath)) throw new Error('Backup checksum does not match')
      }
    } finally { backup.close() }
  }

  async runIfDue() {
    if (!this.status.lastBackupAt || Date.now() - this.status.lastBackupAt >= 24 * 60 * 60 * 1000) {
      try { await this.createBackup('scheduled') } catch (error) { this.status.lastError = error instanceof Error ? error.message : 'Automatic backup failed'; this.writeStatus() }
    }
  }

  private readStatus(): BackupStatus {
    const file = path.join(this.directory, STATUS_FILE)
    try {
      const value = JSON.parse(fs.readFileSync(file, 'utf8')) as BackupStatus
      return { enabled: true, directory: this.directory, lastBackupAt: value.lastBackupAt ?? null, lastBackupPath: value.lastBackupPath ?? null, lastError: value.lastError ?? null }
    } catch { return { enabled: true, directory: this.directory, lastBackupAt: null, lastBackupPath: null, lastError: null } }
  }

  private writeStatus() {
    fs.writeFileSync(path.join(this.directory, STATUS_FILE), JSON.stringify(this.status, null, 2), 'utf8')
  }
}

function checksum(filePath: string) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
}
