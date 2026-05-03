# Deploy all Edge Functions to the new VSWEB project
# Using Supabase CLI with project access token

$env:SUPABASE_ACCESS_TOKEN = "sbp_952cd487e0752adfbf208f4db31e4d961f4ce1fd"
$projectRef = "pirgpqadfodoggcgbwbh"
$functionsDir = "d:\ThinkAI\Visibill\visibill-709fffdf\supabase\functions"

# Function metadata: slug => verify_jwt setting
$functionConfigs = @{
    "nylas-auth" = $true
    "nylas-callback" = $false
    "check-subscription" = $false
    "create-checkout" = $true
    "customer-portal" = $true
    "trigger-invoice-processing" = $true
    "trigger-bank-statement-processing" = $true
    "nav" = $true
    "nav-sync" = $true
    "nav-token" = $true
    "query-nav-invoices" = $true
    "save-credentials" = $false
    "nav-query-outbound-invoices" = $true
    "export-user-data" = $true
    "create-email-alias" = $true
    "delete-email-alias" = $true
    "process-mailgun-webhook" = $false
    "send-invoice-notification" = $true
    "send-welcome-email" = $false
    "send-email" = $false
    "get-invoice-image-url" = $false
    "nav-auto-sync" = $false
    "delete-nav-credentials" = $true
    "send-weekly-summary" = $false
    "trigger-nav-categorization" = $true
    "join-company" = $true
    "trigger-transaction-processing" = $true
    "trigger-salary-processing" = $false
    "send-dunning-email" = $true
    "send-notification-email" = $false
    "check-payment-deadlines" = $false
    "check-subscription-status" = $false
    "check-missing-invoices" = $false
    "send-monthly-summary" = $false
    "verify-email" = $false
}

$successCount = 0
$errorCount = 0
$total = $functionConfigs.Count

foreach ($entry in $functionConfigs.GetEnumerator()) {
    $slug = $entry.Key
    $verifyJwt = $entry.Value
    $funcPath = Join-Path $functionsDir $slug
    
    if (-not (Test-Path $funcPath)) {
        Write-Host "[$($successCount+$errorCount+1)/$total] SKIP: $slug - directory not found" -ForegroundColor Yellow
        $errorCount++
        continue
    }
    
    $jwtFlag = if ($verifyJwt) { "" } else { "--no-verify-jwt" }
    
    Write-Host "[$($successCount+$errorCount+1)/$total] Deploying: $slug (jwt=$verifyJwt)..." -ForegroundColor Cyan -NoNewline
    
    try {
        if ($verifyJwt) {
            $output = npx supabase functions deploy $slug --project-ref $projectRef 2>&1
        } else {
            $output = npx supabase functions deploy $slug --project-ref $projectRef --no-verify-jwt 2>&1
        }
        
        $exitCode = $LASTEXITCODE
        
        if ($exitCode -eq 0) {
            Write-Host " OK" -ForegroundColor Green
            $successCount++
        } else {
            Write-Host " FAILED" -ForegroundColor Red
            Write-Host "  Output: $output" -ForegroundColor DarkRed
            $errorCount++
        }
    } catch {
        Write-Host " ERROR: $($_.Exception.Message)" -ForegroundColor Red
        $errorCount++
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor White
Write-Host "Deployment complete!" -ForegroundColor Green
Write-Host "Success: $successCount / $total" -ForegroundColor Green
if ($errorCount -gt 0) {
    Write-Host "Failed: $errorCount" -ForegroundColor Red
}
