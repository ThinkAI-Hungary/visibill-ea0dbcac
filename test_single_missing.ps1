# Test: 1 new missing invoice detection
# Beszúr egy fake NAV számlát, futtatja a detect-missing-et, aztán takarít

$supabaseUrl = "https://vxxgvdlqvvchtlmqnrqf.supabase.co"
$serviceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4eGd2ZGxxdnZjaHRsbXFucnFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzk3MDA1MCwiZXhwIjoyMDczNTQ2MDUwfQ.YO-8-3sg4m--ms7MCvtwBLOo7ygqxaTbdtvwVwCin_Q"

$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $serviceKey"
    "apikey" = $serviceKey
    "Prefer" = "return=representation"
}

Write-Host "`n=== 1. Keresek egy ceget ami hozzad van rendelve ===" -ForegroundColor Cyan

# Find a company assigned to the test user + get user_id
$assignmentRes = Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/accounty_assignments?select=company_id,accountant_user_id&limit=1" -Method GET -Headers $headers
$testCompanyId = $assignmentRes[0].company_id
$testUserId = $assignmentRes[0].accountant_user_id
Write-Host "  Teszt ceg ID: $testCompanyId" -ForegroundColor Gray
Write-Host "  User ID: $testUserId" -ForegroundColor Gray

# Get company name
$companyRes = Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/companies?id=eq.$testCompanyId&select=name" -Method GET -Headers $headers
$companyName = $companyRes[0].name
Write-Host "  Cegnev: $companyName" -ForegroundColor Gray

Write-Host "`n=== 2. Beszurok 1 fake NAV szamlat ===" -ForegroundColor Cyan

$fakeInvoiceNumber = "TEST-FAKE-$(Get-Date -Format 'yyyyMMddHHmmss')"
$fakeInvoice = @{
    company_id = $testCompanyId
    user_id = $testUserId
    invoice_number = $fakeInvoiceNumber
    supplier_name = "Teszt Szallito Kft."
    supplier_tax_number = "99999999-1-99"
    customer_tax_number = "11111111-1-11"
    invoice_gross_amount = 50000
    invoice_net_amount = 39370
    invoice_vat_amount = 10630
    invoice_issue_date = (Get-Date -Format "yyyy-MM-dd")
    invoice_delivery_date = (Get-Date -Format "yyyy-MM-dd")
    invoice_direction = "INBOUND"
    invoice_operation = "CREATE"
    currency = "HUF"
    payment_method = "TRANSFER"
} | ConvertTo-Json

try {
    $insertRes = Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/nav_invoices" -Method POST -Headers $headers -Body $fakeInvoice -ErrorAction Stop
    $fakeNavId = $insertRes.id
    Write-Host "  Beszurva: $fakeInvoiceNumber (ID: $fakeNavId)" -ForegroundColor Green
} catch {
    Write-Host "  INSERT HIBA: $($_.Exception.Message)" -ForegroundColor Red
    $responseStream = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($responseStream)
    $responseBody = $reader.ReadToEnd()
    Write-Host "  Response: $responseBody" -ForegroundColor DarkRed
    exit 1
}

Write-Host "`n=== 3. Futtatom a detect-missing-et (csak $companyName) ===" -ForegroundColor Cyan

$efHeaders = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $serviceKey"
}

$body = @{ company_id = $testCompanyId } | ConvertTo-Json
$result = Invoke-RestMethod -Uri "$supabaseUrl/functions/v1/accounty-detect-missing" -Method POST -Headers $efHeaders -Body $body
Write-Host "  Eredmeny:" -ForegroundColor Gray
$result | ConvertTo-Json | Write-Host

Write-Host "`n=== 4. Takaritas ===" -ForegroundColor Cyan

$delHeaders = @{
    "Authorization" = "Bearer $serviceKey"
    "apikey" = $serviceKey
}
Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/nav_invoices?id=eq.$fakeNavId" -Method DELETE -Headers $delHeaders
Write-Host "  Fake NAV szamla torolve" -ForegroundColor Green

Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/accounty_missing_items?invoice_number=eq.$fakeInvoiceNumber" -Method DELETE -Headers $delHeaders
Write-Host "  Fake missing item torolve" -ForegroundColor Green

Write-Host "`n=== KESZ! Nezd meg a postaladat ===" -ForegroundColor Cyan
Write-Host "  Ceg: $companyName" -ForegroundColor Gray
Write-Host "  1 uj hianyzo szamla: $fakeInvoiceNumber" -ForegroundColor Gray
Write-Host "  Szallito: Teszt Szallito Kft.`n" -ForegroundColor Gray
