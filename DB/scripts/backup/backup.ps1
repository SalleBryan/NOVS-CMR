<#
.SYNOPSIS
  NOVS-CMR backup utility (Windows / PowerShell 7+).

.DESCRIPTION
  Implements the backup strategy from the report:
    * FULL physical backup using mongodump  (preferred, if the MongoDB
      Database Tools are installed).
    * LOGICAL fallback that (a) clones the database into "novs_cmr_backup"
      via $merge and (b) exports every collection to timestamped JSON,
      so backups still work without the Database Tools installed.

  The "novs_cmr_backup" clone is what scripts/queries/05-recovery-queries.mongosh.js
  (R2) restores an accidentally-deleted document from.

.PARAMETER Mode
  full | logical | auto   (default: auto -> full if mongodump exists, else logical)

.EXAMPLE
  pwsh scripts/backup/backup.ps1
  pwsh scripts/backup/backup.ps1 -Mode full -BackupDir C:\NOVS-Backups
#>
param(
  [ValidateSet('auto', 'full', 'logical')]
  [string]$Mode = 'auto',
  [string]$Db = 'novs_cmr',
  [string]$Uri = 'mongodb://127.0.0.1:27017',
  [string]$BackupDir = $(if ($env:BACKUP_DIR) { $env:BACKUP_DIR } else { 'C:\NOVS-Backups' })
)

$ErrorActionPreference = 'Stop'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

$mongodump = Get-Command mongodump -ErrorAction SilentlyContinue
if ($Mode -eq 'auto') { $Mode = if ($mongodump) { 'full' } else { 'logical' } }

Write-Host "NOVS-CMR backup :: mode=$Mode db=$Db dest=$BackupDir"

if ($Mode -eq 'full') {
  if (-not $mongodump) {
    throw "mongodump not found. Install 'MongoDB Database Tools' or use -Mode logical."
  }
  $out = Join-Path $BackupDir "dump-$stamp"
  & mongodump --uri "$Uri/$Db" --out $out
  Write-Host "FULL backup written to $out"
  Write-Host "Restore with: pwsh scripts/backup/restore.ps1 -Mode full -DumpDir `"$out`""
}
else {
  # --- Logical backup via mongosh ---
  $exportDir = Join-Path $BackupDir "logical-$stamp"
  New-Item -ItemType Directory -Force -Path $exportDir | Out-Null
  $exportDirJs = $exportDir.Replace('\', '\\')

  $js = @"
const src = db.getSiblingDB('$Db');
const bak = db.getSiblingDB('${Db}_backup');
const fs  = require('fs');
const cols = src.getCollectionNames();
print('Cloning ' + cols.length + ' collections into ${Db}_backup ...');
cols.forEach(function (c) {
  // 1) hot clone into the *_backup database (used by R2 recovery)
  bak.getCollection(c).drop();
  const docs = src.getCollection(c).find().toArray();
  if (docs.length) bak.getCollection(c).insertMany(docs);
  // 2) JSON export to disk
  fs.writeFileSync('${exportDirJs}\\' + c + '.json', EJSON.stringify(docs, null, 2));
  print('  ' + c + ': ' + docs.length + ' docs');
});
print('Logical backup + clone complete.');
"@
  $tmp = Join-Path $env:TEMP "novs-backup-$stamp.js"
  Set-Content -Path $tmp -Value $js -Encoding UTF8
  & mongosh "$Uri" $tmp
  Remove-Item $tmp -Force
  Write-Host "LOGICAL backup written to $exportDir"
  Write-Host "Clone database '${Db}_backup' refreshed (used by recovery query R2)."
}
