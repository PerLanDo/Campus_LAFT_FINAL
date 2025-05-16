import { createClient } from '@supabase/supabase-js';
import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
// @ts-ignore - dotenv doesn't have type definitions
import * as dotenv from 'dotenv';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

// Configuration
const BACKUP_DIR = path.join(__dirname, '../../backups');
const KEEP_DAILY = 30; // Keep daily backups for 30 days
const KEEP_WEEKLY = 12; // Keep weekly backups for 12 weeks
const KEEP_MONTHLY = 12; // Keep monthly backups for 12 months

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Supabase URL or key is missing in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Ensure backup directory exists
const ensureBackupDir = () => {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
};

// Generate backup filename with timestamp
const generateBackupFilename = (type: 'daily' | 'weekly' | 'monthly'): string => {
  const now = new Date();
  const dateStr = now.toISOString().replace(/[:.]/g, '-');
  return `backup-${type}-${dateStr}.sql`;
};

// Backup database using pg_dump
const backupDatabase = async (): Promise<string> => {
  const dbUrl = process.env.DATABASE_URL || '';
  if (!dbUrl) {
    throw new Error('DATABASE_URL not found in environment variables');
  }

  const backupType = getBackupType();
  const filename = generateBackupFilename(backupType);
  const filepath = path.join(BACKUP_DIR, filename);

  try {
    // Use pg_dump to create a backup
    const { stdout, stderr } = await execAsync(
      `pg_dump ${dbUrl} > ${filepath}`
    );

    if (stderr) {
      console.warn('pg_dump stderr:', stderr);
    }

    console.log(`Backup created successfully: ${filepath}`);
    return filepath;
  } catch (error) {
    console.error('Error creating backup:', error);
    throw error;
  }
};

// Determine backup type based on current date
const getBackupType = (): 'daily' | 'weekly' | 'monthly' => {
  const now = new Date();
  
  // First day of month
  if (now.getDate() === 1) return 'monthly';
  
  // Sunday
  if (now.getDay() === 0) return 'weekly';
  
  return 'daily';
};

// Clean up old backups
const cleanupOldBackups = () => {
  try {
    const files = fs.readdirSync(BACKUP_DIR);
    const now = new Date();

    const backupFiles = files
      .filter(file => file.endsWith('.sql'))
      .map(file => ({
        name: file,
        path: path.join(BACKUP_DIR, file),
        date: getDateFromFilename(file)
      }))
      .filter((file): file is { name: string; path: string; date: Date } => file.date !== null) // Filter out files with invalid dates
      .sort((a, b) => b.date.getTime() - a.date.getTime());

    // Group by type
    const daily = backupFiles.filter(f => f.name.includes('daily'));
    const weekly = backupFiles.filter(f => f.name.includes('weekly'));
    const monthly = backupFiles.filter(f => f.name.includes('monthly'));

    // Remove old backups
    const removeOldBackups = (backups: typeof backupFiles, keep: number) => {
      if (backups.length <= keep) return;
      
      const toRemove = backups.slice(keep);
      toRemove.forEach(file => {
        try {
          fs.unlinkSync(file.path);
          console.log(`Removed old backup: ${file.name}`);
        } catch (err) {
          console.error(`Error removing ${file.name}:`, err);
        }
      });
    };

    removeOldBackups(daily, KEEP_DAILY);
    removeOldBackups(weekly, KEEP_WEEKLY);
    removeOldBackups(monthly, KEEP_MONTHLY);
  } catch (error) {
    console.error('Error cleaning up old backups:', error);
  }
};

// Extract date from filename
const getDateFromFilename = (filename: string): Date | null => {
  const match = filename.match(/(\d{4}-\d{2}-\d{2})/);
  if (!match) return null;
  
  try {
    return new Date(match[1]);
  } catch (e) {
    return null;
  }
};

// Main backup function
const main = async () => {
  try {
    console.log('Starting database backup...');
    ensureBackupDir();
    
    await backupDatabase();
    cleanupOldBackups();
    
    console.log('Backup process completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Backup failed:', error);
    process.exit(1);
  }
};

// Run the backup if this file is executed directly
if (require.main === module) {
  main();
}

export { backupDatabase, cleanupOldBackups };
