# web-design-pipeline installer for Windows (PowerShell): taste-skill + ui-ux-pro-max + impeccable + the pipeline skill.
#
#   .\install.ps1                      install for every project (%USERPROFILE%\.claude\skills)
#   .\install.ps1 -Project C:\path     install into C:\path\.claude\skills (commit it so cloud sessions get it)
#   .\install.ps1 -Agents              also install into %USERPROFILE%\.agents\skills
#   .\install.ps1 -Latest              use each upstream's newest commit instead of the pins
#   .\install.ps1 -Uninstall [-Project C:\path]
#
# Needs git, Node 22+, Python 3 and Chrome or Edge. Free tools only; no API keys.
param([string]$Project = "", [switch]$Agents, [switch]$Latest, [switch]$Uninstall)
$ErrorActionPreference = "Stop"
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$Lock = Get-Content (Join-Path $Here "pipeline.lock.json") -Raw | ConvertFrom-Json
$Cache = if ($env:DP_CACHE) { $env:DP_CACHE } else { Join-Path $env:USERPROFILE ".cache\web-design-pipeline" }
$Targets = @()
if ($Project) { $Targets += (Join-Path (Resolve-Path $Project) ".claude\skills") } else { $Targets += (Join-Path $env:USERPROFILE ".claude\skills") }
if ($Agents) { $Targets += (Join-Path $env:USERPROFILE ".agents\skills") }

if ($Uninstall) {
  foreach ($t in $Targets) {
    foreach ($s in $Lock.skills) { Remove-Item -Recurse -Force -ErrorAction SilentlyContinue (Join-Path $t $s.name) }
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue (Join-Path $t "web-design-pipeline")
    Write-Host "removed from $t"
  }
  exit 0
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw "git is required" }
New-Item -ItemType Directory -Force -Path $Cache | Out-Null
foreach ($s in $Lock.skills) {
  $src = Join-Path $Cache $s.name
  if (-not (Test-Path (Join-Path $src ".git"))) { git init -q $src; git -C $src remote add origin $s.repo }
  if ($Latest) {
    git -C $src fetch -q --depth 1 origin HEAD; git -C $src checkout -q --force FETCH_HEAD
    Write-Host "pin for $($s.name): $(git -C $src rev-parse HEAD)  (update pipeline.lock.json after testing)"
  } elseif ((git -C $src rev-parse HEAD 2>$null) -ne $s.commit) {
    git -C $src fetch -q --depth 1 origin $s.commit; git -C $src checkout -q --force FETCH_HEAD
  }
  foreach ($t in $Targets) {
    New-Item -ItemType Directory -Force -Path $t | Out-Null
    $dest = Join-Path $t $s.name
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $dest
    Copy-Item -Recurse (Join-Path $src $s.path) $dest
    foreach ($f in $s.licenseFiles) { $lf = Join-Path $src $f; if (Test-Path $lf) { Copy-Item $lf (Join-Path $dest "UPSTREAM-$f") } }
    Set-Content (Join-Path $dest "UPSTREAM") "$($s.repo)`n$(git -C $src rev-parse HEAD)"
  }
  Write-Host "installed $($s.name) ($(git -C $src rev-parse --short HEAD))"
}
foreach ($t in $Targets) {
  Remove-Item -Recurse -Force -ErrorAction SilentlyContinue (Join-Path $t "web-design-pipeline")
  Copy-Item -Recurse (Join-Path $Here "skills\web-design-pipeline") (Join-Path $t "web-design-pipeline")
}
Write-Host "installed web-design-pipeline"
$imp = Join-Path $env:USERPROFILE ".impeccable"
New-Item -ItemType Directory -Force -Path $imp | Out-Null
if (-not (Test-Path (Join-Path $imp "config.json"))) { Set-Content (Join-Path $imp "config.json") '{ "telemetry": false }' }
Write-Host "done -> $($Targets -join ', ')"
Write-Host "use: ask Claude to build or improve a website; the web-design-pipeline skill runs the stages."
