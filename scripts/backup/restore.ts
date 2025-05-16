import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { exec } from 'child_process';
import { promisify } from 'util';
// @ts-ignore - dotenv doesn't have type definitions
import * as dotenv from 'dotenv';

const execAsync = promisify(exec);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

// Configuration
const BACKUP_DIR = path.join(__dirname, '../../backups');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query: string): Promise<string> => {
  return new Promise(resolve => rl.question(query, resolve));
};

// List available backups
const listBackups = (): string[] => {
  try {
    return fs.readdirSync(BACKUP_DIR)
      .filter(file => file.endsWith('.sql'))
      .sort()
      .reverse(); // Show newest first
  } catch (error) {
    console.error('Error reading backup directory:', error);
    return [];
  }
};

// Restore database from backup
const restoreDatabase = async (backupFile: string): Promise<void> => {
  const dbUrl = process.env.DATABASE_URL || '';
  if (!dbUrl) {
    throw new Error('DATABASE_URL not found in environment variables');
  }

  const filepath = path.join(BACKUP_DIR, backupFile);
  
  if (!fs.existsSync(filepath)) {
    throw new Error(`Backup file not found: ${filepath}`);
  }

  console.log(`\nWARNING: This will overwrite your current database with the backup from ${backupFile}`);
  console.log('This action cannot be undone!');
  
  const confirm = await question('Are you sure you want to continue? (yes/no): ');
  
  if (confirm.toLowerCase() !== 'yes') {
    console.log('Restore cancelled');
    return;
  }

  try {
    console.log(`\nRestoring database from ${backupFile}...`);
    
    // Use psql to restore the database
    const { stdout, stderr } = await execAsync(
      `psql ${dbUrl} -f ${filepath}`
    );

    if (stderr) {
      console.warn('psql stderr:', stderr);
    }

    console.log('\nDatabase restore completed successfully!');
  } catch (error) {
    console.error('Error restoring database:', error);
    throw error;
  }
};

// Main function
const main = async () => {
  try {
    console.log('\n=== Database Restore Utility ===\n');
    
    const backups = listBackups();
    
    if (backups.length === 0) {
      console.log('No backup files found in', BACKUP_DIR);
      rl.close();
      return;
    }
    
    console.log('Available backups:');
    backups.forEach((file, index) => {
      console.log(`[${index + 1}] ${file}`);
    });
    
    const answer = await question('\nEnter the number of the backup to restore (or q to quit): ');
    
    if (answer.toLowerCase() === 'q') {
      console.log('Restore cancelled');
      rl.close();
      return;
    }
    
    const index = parseInt(answer, 10) - 1;
    
    if (isNaN(index) || index < 0 || index >= backups.length) {
      console.log('Invalid selection');
      rl.close();
      return;
    }
    
    await restoreDatabase(backups[index]);
  } catch (error) {
    console.error('Restore failed:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
};

// Run the restore if this file is executed directly
if (require.main === module) {
  main();
}

export { restoreDatabase, listBackups };
