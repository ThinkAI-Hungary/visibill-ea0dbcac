#!/usr/bin/env pwsh
$ErrorActionPreference = "Stop"

$repoSkillsDir = Join-Path $PSScriptRoot ".agents\skills"
$userSkillsDir = Join-Path $env:USERPROFILE ".gemini\config\skills"

Write-Host ""
Write-Host "=== Visibill AI Skills Setup ===" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $repoSkillsDir)) {
    Write-Host "ERROR: Skills directory not found: $repoSkillsDir" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $userSkillsDir)) {
    New-Item -ItemType Directory -Force -Path $userSkillsDir | Out-Null
    Write-Host "Created: $userSkillsDir" -ForegroundColor Yellow
}

$skills = Get-ChildItem $repoSkillsDir -Directory
$installed = 0
$skipped = 0
$updated = 0

foreach ($skill in $skills) {
    $targetPath = Join-Path $userSkillsDir $skill.Name
    
    if (Test-Path $targetPath) {
        $item = Get-Item $targetPath -Force
        if ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
            $existingTarget = (Get-Item $targetPath).Target
            if ($existingTarget -eq $skill.FullName) {
                Write-Host "  OK: $($skill.Name) (symlink exists)" -ForegroundColor DarkGray
                $skipped++
                continue
            } else {
                Remove-Item $targetPath -Force
                New-Item -ItemType SymbolicLink -Path $targetPath -Target $skill.FullName | Out-Null
                Write-Host "  UPDATED: $($skill.Name) (symlink re-pointed)" -ForegroundColor Yellow
                $updated++
            }
        } else {
            $backupPath = "$targetPath.backup.$(Get-Date -Format 'yyyyMMdd-HHmmss')"
            Move-Item $targetPath $backupPath
            New-Item -ItemType SymbolicLink -Path $targetPath -Target $skill.FullName | Out-Null
            Write-Host "  UPDATED: $($skill.Name) (backed up + symlinked)" -ForegroundColor Yellow
            $updated++
        }
    } else {
        New-Item -ItemType SymbolicLink -Path $targetPath -Target $skill.FullName | Out-Null
        Write-Host "  NEW: $($skill.Name)" -ForegroundColor Green
        $installed++
    }
}

Write-Host ""
Write-Host "=== Done ===" -ForegroundColor Cyan
Write-Host "  Total:   $($skills.Count) skills" -ForegroundColor White
Write-Host "  New:     $installed" -ForegroundColor Green
Write-Host "  Updated: $updated" -ForegroundColor Yellow  
Write-Host "  Skipped: $skipped" -ForegroundColor DarkGray
Write-Host ""
Write-Host "Skills are loaded from the repo via symlinks." -ForegroundColor White
Write-Host "Run 'git pull' to get updates." -ForegroundColor White
Write-Host ""
