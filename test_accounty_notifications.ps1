# eaisyBooks Notification Test Script
# Meghívja mind a 4 Edge Function-t tesztelésre
# Az emailek a nagyd965@gmail.com-ra fognak menni

$supabaseUrl = "https://vxxgvdlqvvchtlmqnrqf.supabase.co"
$serviceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4eGd2ZGxxdnZjaHRsbXFucnFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzk3MDA1MCwiZXhwIjoyMDczNTQ2MDUwfQ.YO-8-3sg4m--ms7MCvtwBLOo7ygqxaTbdtvwVwCin_Q"

$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $serviceKey"
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "eaisyBooks Notification Test" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# 1. Határidő emlékeztető
Write-Host "[1/4] Határidő emlékeztető (accounty-check-deadlines)..." -ForegroundColor Yellow -NoNewline
try {
    $r1 = Invoke-RestMethod -Uri "$supabaseUrl/functions/v1/accounty-check-deadlines" -Method POST -Headers $headers -Body "{}" -ErrorAction Stop
    Write-Host " OK" -ForegroundColor Green
    Write-Host "  Result: $($r1 | ConvertTo-Json -Compress)" -ForegroundColor Gray
} catch {
    Write-Host " FAILED" -ForegroundColor Red
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor DarkRed
}

# 2. Hiányzó számla + ügyfél státusz változás
Write-Host "[2/4] Hiányzó számla + státusz változás (accounty-detect-missing)..." -ForegroundColor Yellow -NoNewline
try {
    $r2 = Invoke-RestMethod -Uri "$supabaseUrl/functions/v1/accounty-detect-missing" -Method POST -Headers $headers -Body "{}" -ErrorAction Stop
    Write-Host " OK" -ForegroundColor Green
    Write-Host "  Result: $($r2 | ConvertTo-Json -Compress)" -ForegroundColor Gray
} catch {
    Write-Host " FAILED" -ForegroundColor Red
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor DarkRed
}

# 3. Heti riport
Write-Host "[3/4] Heti riport (send-accounty-weekly-report)..." -ForegroundColor Yellow -NoNewline
try {
    $r3 = Invoke-RestMethod -Uri "$supabaseUrl/functions/v1/send-accounty-weekly-report" -Method POST -Headers $headers -Body "{}" -ErrorAction Stop
    Write-Host " OK" -ForegroundColor Green
    Write-Host "  Result: $($r3 | ConvertTo-Json -Compress)" -ForegroundColor Gray
} catch {
    Write-Host " FAILED" -ForegroundColor Red
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor DarkRed
}

# 4. Havi riport
Write-Host "[4/4] Havi riport (send-accounty-monthly-report)..." -ForegroundColor Yellow -NoNewline
try {
    $r4 = Invoke-RestMethod -Uri "$supabaseUrl/functions/v1/send-accounty-monthly-report" -Method POST -Headers $headers -Body "{}" -ErrorAction Stop
    Write-Host " OK" -ForegroundColor Green
    Write-Host "  Result: $($r4 | ConvertTo-Json -Compress)" -ForegroundColor Gray
} catch {
    Write-Host " FAILED" -ForegroundColor Red
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor DarkRed
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Kész! Nézd meg a nagyd965@gmail.com postaládádat." -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan
