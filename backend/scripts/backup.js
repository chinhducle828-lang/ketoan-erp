import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { redis as redisClient } from '../cache/redis.js';

const execAsync = promisify(exec);

// Backup configuration
const BACKUP_CONFIG = {
  pgHost: process.env.DB_HOST || 'localhost',
  pgPort: process.env.DB_PORT || 5432,
  pgUser: process.env.DB_USER || 'postgres',
  pgPassword: process.env.DB_PASSWORD || 'postgres',
  pgDatabase: process.env.DB_NAME || 'ketoan',
  backupDir: process.env.BACKUP_DIR || './backups',
  retentionDays: 30
};

// Backup service
class BackupService {
  constructor() {
    this.ensureBackupDir();
  }

  // Ensure backup directory exists
  ensureBackupDir() {
    if (!fs.existsSync(BACKUP_CONFIG.backupDir)) {
      fs.mkdirSync(BACKUP_CONFIG.backupDir, { recursive: true });
    }
  }

  // Create full backup
  async createFullBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `full_backup_${timestamp}.sql`;
    const filepath = path.join(BACKUP_CONFIG.backupDir, filename);

    try {
      const cmd = `pg_dump -h ${BACKUP_CONFIG.pgHost} -p ${BACKUP_CONFIG.pgPort} -U ${BACKUP_CONFIG.pgUser} -F c -f "${filepath}" ${BACKUP_CONFIG.pgDatabase}`;
      
      await execAsync(cmd);
      
      // Cache backup info
      await redisClient.setex(
        `backup:last_full`,
        86400,
        JSON.stringify({ filename, timestamp, size: fs.statSync(filepath).size })
      );

      return { success: true, filename, filepath };
    } catch (error) {
      console.error('Full backup error:', error);
      return { success: false, error: error.message };
    }
  }

  // Create incremental backup (PITR)
  async createIncrementalBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `incremental_${timestamp}.sql`;
    const filepath = path.join(BACKUP_CONFIG.backupDir, filename);

    try {
      // Get last backup time
      const lastBackup = await redisClient.get('backup:last_incremental');
      const sinceTime = lastBackup ? JSON.parse(lastBackup).timestamp : null;

      let cmd;
      if (sinceTime) {
        // Incremental since last backup
        cmd = `pg_dump -h ${BACKUP_CONFIG.pgHost} -p ${BACKUP_CONFIG.pgPort} -U ${BACKUP_CONFIG.pgUser} -F c --since="${sinceTime}" -f "${filepath}" ${BACKUP_CONFIG.pgDatabase}`;
      } else {
        // Full backup if no incremental
        return this.createFullBackup();
      }

      await execAsync(cmd);
      
      // Cache backup info
      await redisClient.setex(
        `backup:last_incremental`,
        86400,
        JSON.stringify({ filename, timestamp, size: fs.statSync(filepath).size })
      );

      return { success: true, filename, filepath };
    } catch (error) {
      console.error('Incremental backup error:', error);
      return { success: false, error: error.message };
    }
  }

  // Restore from backup
  async restoreFromBackup(filename) {
    const filepath = path.join(BACKUP_CONFIG.backupDir, filename);

    if (!fs.existsSync(filepath)) {
      return { success: false, error: 'Backup file not found' };
    }

    try {
      const cmd = `pg_restore -h ${BACKUP_CONFIG.pgHost} -p ${BACKUP_CONFIG.pgPort} -U ${BACKUP_CONFIG.pgUser} -d ${BACKUP_CONFIG.pgDatabase} -c "${filepath}"`;
      
      await execAsync(cmd);
      
      return { success: true };
    } catch (error) {
      console.error('Restore error:', error);
      return { success: false, error: error.message };
    }
  }

  // List available backups
  async listBackups() {
    try {
      const files = fs.readdirSync(BACKUP_CONFIG.backupDir);
      const backups = files
        .filter(f => f.endsWith('.sql'))
        .map(f => ({
          filename: f,
          path: path.join(BACKUP_CONFIG.backupDir, f),
          size: fs.statSync(path.join(BACKUP_CONFIG.backupDir, f)).size,
          created: fs.statSync(path.join(BACKUP_CONFIG.backupDir, f)).birthtime
        }))
        .sort((a, b) => b.created - a.created);

      return backups;
    } catch (error) {
      console.error('List backups error:', error);
      return [];
    }
  }

  // Clean old backups
  async cleanOldBackups() {
    const backups = await this.listBackups();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - BACKUP_CONFIG.retentionDays);

    let cleaned = 0;
    for (const backup of backups) {
      if (backup.created < cutoffDate) {
        fs.unlinkSync(backup.path);
        cleaned++;
      }
    }

    return { cleaned, total: backups.length };
  }

  // Schedule backup
  scheduleBackup(cronExpression = '0 2 * * *') {
    // In production, use node-cron or similar
    console.log(`Backup scheduled: ${cronExpression}`);
  }
}

// Singleton instance
const backupService = new BackupService();
export default backupService;