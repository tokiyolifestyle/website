$envContent = Get-Content -Path "c:\Users\HP\Downloads\tokiyo-theme\.env"
$envVars = @{}
foreach ($line in $envContent) {
    if ($line -match '^\s*([^#=]+)=(.*)$') {
        $envVars[$matches[1].Trim()] = $matches[2].Trim()
    }
}
$shop = $envVars["SHOPIFY_STORE_DOMAIN"]
$token = $envVars["SHOPIFY_ACCESS_TOKEN"]
$headers = @{
    "X-Shopify-Access-Token" = $token
    "Content-Type"           = "application/json"
}

$variants = @("49329616388340", "49329616945396", "49329617142004", "49329617174772")
foreach ($v in $variants) {
    $r = Invoke-RestMethod -Uri "https://$shop/admin/api/2024-10/variants/$v.json" -Method Get -Headers $headers
    Write-Host "Variant $($v) - mgmt=$($r.variant.inventory_management), policy=$($r.variant.inventory_policy), qty=$($r.variant.inventory_quantity)"
    # If inventory_policy is 'deny' and qty is 0, customers wouldn't be able to checkout if inventory_management is shopify.
    # Set inventory_policy to 'continue' or inventory_management to null (untracked unlimited)
    if ($r.variant.inventory_management -ne $null -or $r.variant.inventory_policy -ne "continue") {
        $updateBody = @{
            variant = @{
                id = [int64]$v
                inventory_management = $null
                inventory_policy = "continue"
            }
        } | ConvertTo-Json
        $upRes = Invoke-RestMethod -Uri "https://$shop/admin/api/2024-10/variants/$v.json" -Method Put -Headers $headers -Body $updateBody
        Write-Host "Updated $v to inventory_management=null, inventory_policy=continue" -ForegroundColor Green
    }
}
