# Database Backup System

This directory contains scripts for managing database backups and restorations for the CampusLAFT application.

## Features

- **Automated Backups**: Scheduled backups with retention policies
- **Multiple Backup Types**: Daily, weekly, and monthly backups
- **Easy Restoration**: Simple command-line interface for restoring from backups
- **Retention Policies**: Automatic cleanup of old backups

## Prerequisites

1. Node.js 14.0.0 or later
2. PostgreSQL client tools (`pg_dump` and `psql`) installed and in your PATH
3. Access to the Supabase database

## Setup

1. Navigate to the scripts directory:
   ```bash
   cd scripts
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the project root with your database connection details:
   ```env
   DATABASE_URL=postgresql://user:password@host:port/dbname
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   ```

## Usage

### Creating a Backup

To create a manual backup:

```bash
npm run backup
```

### Listing Available Backups

To list all available backups:

```bash
npm run list
```

### Restoring from a Backup

To restore from a backup:

```bash
npm run restore
```

Follow the on-screen prompts to select and confirm the restore operation.

## Automated Backups

### Windows Task Scheduler

1. Open Task Scheduler
2. Create a new task
3. Set the trigger to run daily
4. Set the action to run a command:
   ```
   cmd /c "cd /d C:\path\to\project\scripts && npm run backup"
   ```

### Linux/MacOS (cron)

Add this line to your crontab (run `crontab -e`):

```
0 2 * * * cd /path/to/project/scripts && /usr/bin/npm run backup >/tmp/backup.log 2>&1
```

This will run the backup daily at 2 AM.

## Backup Retention

The system maintains:
- Daily backups for 30 days
- Weekly backups for 12 weeks
- Monthly backups for 12 months

## Security Notes

- Ensure your `.env` file is not committed to version control
- Store backups in a secure location
- Consider encrypting backups that contain sensitive information
- Limit access to backup files to authorized personnel only

## Troubleshooting

- **pg_dump/psql not found**: Ensure PostgreSQL client tools are installed and in your PATH
- **Permission denied**: Ensure the script has write permissions to the backup directory
- **Connection errors**: Verify your database connection string and network access
