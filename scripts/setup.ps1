# Install required Node.js packages
Write-Host "Installing Node.js packages..." -ForegroundColor Cyan
npm install

# Create backup directory if it doesn't exist
$backupDir = "$PSScriptRoot/backups"
if (-not (Test-Path -Path $backupDir)) {
    Write-Host "Creating backup directory: $backupDir" -ForegroundColor Cyan
    New-Item -ItemType Directory -Path $backupDir | Out-Null
}

# Create .env file if it doesn't exist
$envFile = "$PSScriptRoot/../.env.local"
$exampleEnvFile = "$PSScriptRoot/../.env.local.example"

if (-not (Test-Path -Path $envFile) -and (Test-Path -Path $exampleEnvFile)) {
    Write-Host "Creating .env file from example..." -ForegroundColor Cyan
    Copy-Item -Path $exampleEnvFile -Destination $envFile
    Write-Host "Please update the DATABASE_URL in $envFile with your Supabase connection string" -ForegroundColor Yellow
}

Write-Host "`nSetup complete!" -ForegroundColor Green
Write-Host "1. Update the DATABASE_URL in $envFile with your Supabase connection string"
Write-Host "2. Run 'npm run backup' to create your first backup"
Write-Host "3. Run 'npm run restore' to restore from a backup" -ForegroundColor Cyan
