<#
.SYNOPSIS
  NOVS-CMR restore utility (Windows / PowerShell 7+).

.DESCRIPTION
  Restores a backup produced by backup.ps1.
    * full    : mongorestore from a BSON dump directory.
    * logical : re-import the JSON files produced by the logical backup,
                OR copy back from the novs_cmr_backup clone database.

.EXAMPLE
  pwsh scripts/backup/restore.ps1 -Mode full -DumpDir C:\NOVS-Backups\dump-20260529-101500
  pwsh scripts/backup/restore.ps1 -Mode logical -ExportDir C:\NOVS-Backups\logical-20260529-101500
  pwsh scripts/backup/restore.ps1 -Mode clone   # copy everything back from novs_cmr_backup
#>
param(
  [ValidateSet('full', 'logical', 'clone')]
  [string]$Mode = 'clone',
  [string]$Db = 'novs_cmr',
  [string]$Uri = 'mongodb://127.0.0.1:27017',
  [string]$DumpDir,
  [string]$ExportDir
)

$ErrorActionPreference = 'Stop'

if ($Mode -eq 'full') {
  $mongorestore = Get-Command mongorestore -ErrorAction SilentlyContinue
  if (-not $mongorestore) { throw "mongorestore not found. Install 'MongoDB Database Tools'." }
  if (-not $DumpDir) { throw "Provide -DumpDir (the folder containing the '$Db' dump)." }
  & mongorestore --uri "$Uri" --drop $DumpDir
  Write-Host "FULL restore from $DumpDir complete."
}
elseif ($Mode -eq 'clone') {
  $js = @"
const live = db.getSiblingDB('$Db');
const bak  = db.getSiblingDB('${Db}_backup');
const cols = bak.getCollectionNames();
if (!cols.length) { print('No backup clone found (${Db}_backup is empty).'); quit(1); }
cols.forEach(function (c) {
  live.getCollection(c).drop();
  const docs = bak.getCollection(c).find().toArray();
  if (docs.length) live.getCollection(c).insertMany(docs);
  print('  restored ' + c + ': ' + docs.length + ' docs');
});
print('Clone restore complete.');
"@
  $tmp = Join-Path $env:TEMP "novs-restore.js"
  Set-Content -Path $tmp -Value $js -Encoding UTF8
  & mongosh "$Uri" $tmp
  Remove-Item $tmp -Force
}
else {
  if (-not $ExportDir) { throw "Provide -ExportDir (the logical-* folder of JSON files)." }
  $ExportDirJs = $ExportDir.Replace('\', '\\')
  $js = @"
const live = db.getSiblingDB('$Db');
const fs = require('fs');
const files = fs.readdirSync('$ExportDirJs').filter(f => f.endsWith('.json'));
files.forEach(function (f) {
  const c = f.replace('.json','');
  const docs = EJSON.parse(fs.readFileSync('${ExportDirJs}\\' + f, 'utf8'));
  live.getCollection(c).drop();
  if (docs.length) live.getCollection(c).insertMany(docs);
  print('  restored ' + c + ': ' + docs.length + ' docs');
});
print('Logical restore complete.');
"@
  $tmp = Join-Path $env:TEMP "novs-restore-logical.js"
  Set-Content -Path $tmp -Value $js -Encoding UTF8
  & mongosh "$Uri" $tmp
  Remove-Item $tmp -Force
}
