# Extract Edge Functions from MCP output files
# This script reads the saved JSON outputs and creates local function directories

$basePath = "d:\ThinkAI\Visibill\visibill-709fffdf\supabase\functions"
$stepsPath = "C:\Users\Morfi\.gemini\antigravity\brain\26aa92c1-c509-403a-82f9-de9047d30994\.system_generated\steps"

# Mapping of step numbers to function slugs
$stepMappings = @(
    @{Step=90; Slug="nylas-auth"},
    @{Step=91; Slug="nylas-callback"},
    @{Step=92; Slug="check-subscription"},
    @{Step=93; Slug="create-checkout"},
    @{Step=94; Slug="customer-portal"},
    @{Step=95; Slug="trigger-invoice-processing"},
    @{Step=96; Slug="trigger-bank-statement-processing"},
    @{Step=97; Slug="nav"},
    @{Step=98; Slug="nav-sync"},
    @{Step=99; Slug="nav-token"},
    @{Step=104; Slug="query-nav-invoices"},
    @{Step=105; Slug="save-credentials"},
    @{Step=106; Slug="nav-query-outbound-invoices"},
    @{Step=107; Slug="export-user-data"},
    @{Step=108; Slug="create-email-alias"},
    @{Step=109; Slug="delete-email-alias"},
    @{Step=110; Slug="process-mailgun-webhook"},
    @{Step=111; Slug="send-invoice-notification"},
    @{Step=112; Slug="send-welcome-email"},
    @{Step=113; Slug="send-email"},
    @{Step=116; Slug="get-invoice-image-url"},
    @{Step=117; Slug="nav-auto-sync"},
    @{Step=118; Slug="delete-nav-credentials"},
    @{Step=119; Slug="send-weekly-summary"},
    @{Step=120; Slug="trigger-nav-categorization"},
    @{Step=121; Slug="join-company"},
    @{Step=122; Slug="trigger-transaction-processing"},
    @{Step=123; Slug="trigger-salary-processing"},
    @{Step=124; Slug="send-dunning-email"},
    @{Step=125; Slug="send-notification-email"},
    @{Step=128; Slug="check-payment-deadlines"},
    @{Step=129; Slug="check-subscription-status"},
    @{Step=130; Slug="check-missing-invoices"},
    @{Step=131; Slug="send-monthly-summary"},
    @{Step=132; Slug="verify-email"}
)

$successCount = 0
$errorCount = 0

foreach ($mapping in $stepMappings) {
    $stepFile = Join-Path $stepsPath "$($mapping.Step)\output.txt"
    $slug = $mapping.Slug
    
    try {
        if (-not (Test-Path $stepFile)) {
            Write-Host "SKIP: $slug - step file not found at $stepFile" -ForegroundColor Yellow
            $errorCount++
            continue
        }
        
        $raw = Get-Content $stepFile -Raw -Encoding UTF8
        
        # Try to parse as JSON directly or extract JSON from the text
        $json = $null
        try {
            $json = $raw | ConvertFrom-Json
        } catch {
            # The file might have the JSON embedded - try to find it
            if ($raw -match '\{.*"files".*\}') {
                $jsonStr = $Matches[0]
                try {
                    $json = $jsonStr | ConvertFrom-Json
                } catch {}
            }
        }
        
        if (-not $json) {
            # Try to find JSON object with slug
            $pattern = '\{[^{}]*"slug"\s*:\s*"' + [regex]::Escape($slug) + '"[^{}]*"files"\s*:\s*\[.*?\]\s*\}'
            if ($raw -match '(?s)\{.*?"slug"\s*:\s*"[^"]*".*?"files"\s*:\s*\[.*?\]\s*\}') {
                try {
                    $json = $Matches[0] | ConvertFrom-Json
                } catch {}
            }
        }
        
        $files = $null
        if ($json -and $json.files) {
            $files = $json.files
        } elseif ($json -and $json.output -and $json.output -match '"files"') {
            # The output field itself contains JSON
            try {
                $innerJson = $json.output | ConvertFrom-Json
                $files = $innerJson.files
            } catch {
                # Try regex extraction from output field
                if ($json.output -match '"content"\s*:\s*"((?:[^"\\]|\\.)*)') {
                    # We'll handle this below
                }
            }
        }
        
        if ($files -and $files.Count -gt 0) {
            $funcDir = Join-Path $basePath $slug
            New-Item -Path $funcDir -ItemType Directory -Force | Out-Null
            
            foreach ($file in $files) {
                $content = $file.content
                $fileName = Split-Path $file.name -Leaf
                $filePath = Join-Path $funcDir $fileName
                
                Set-Content -Path $filePath -Value $content -Encoding UTF8 -NoNewline
                Write-Host "OK: $slug/$fileName" -ForegroundColor Green
            }
            $successCount++
        } else {
            Write-Host "WARN: $slug - no files array found, trying regex..." -ForegroundColor Yellow
            
            # Last resort: regex extract content from raw text
            $contentMatches = [regex]::Matches($raw, '"content"\s*:\s*"((?:[^"\\]|\\.)*)"')
            if ($contentMatches.Count -gt 0) {
                $funcDir = Join-Path $basePath $slug
                New-Item -Path $funcDir -ItemType Directory -Force | Out-Null
                
                $content = $contentMatches[0].Groups[1].Value
                # Unescape JSON string
                $content = $content -replace '\\n', "`n"
                $content = $content -replace '\\t', "`t"
                $content = $content -replace '\\"', '"'
                $content = $content -replace '\\\\', '\'
                $content = $content -replace '\\/', '/'
                
                $filePath = Join-Path $funcDir "index.ts"
                Set-Content -Path $filePath -Value $content -Encoding UTF8 -NoNewline
                Write-Host "OK (regex): $slug/index.ts" -ForegroundColor Cyan
                $successCount++
            } else {
                Write-Host "ERROR: $slug - could not extract content" -ForegroundColor Red
                $errorCount++
            }
        }
    } catch {
        Write-Host "ERROR: $slug - $($_.Exception.Message)" -ForegroundColor Red
        $errorCount++
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor White
Write-Host "Extraction complete!" -ForegroundColor Green
Write-Host "Success: $successCount / $($stepMappings.Count)" -ForegroundColor Green
if ($errorCount -gt 0) {
    Write-Host "Errors: $errorCount" -ForegroundColor Red
}
Write-Host "Output: $basePath" -ForegroundColor Cyan
