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

# 1. Women's Trio: 49329616388340 -> Price 1969, Compare 2197
# 2. Women's Duo: 49329616945396 -> Price 1349, Compare 1498
# 3. Men's Duo: 49329617142004 -> Price 1269, Compare 1408
# 4. Men's Trio: 49329617174772 -> Price 1869, Compare 2057

$items = @(
    @{ id = "49329616388340"; price = "1969.00"; compare = "2197.00" },
    @{ id = "49329616945396"; price = "1349.00"; compare = "1498.00" },
    @{ id = "49329617142004"; price = "1269.00"; compare = "1408.00" },
    @{ id = "49329617174772"; price = "1869.00"; compare = "2057.00" }
)

foreach ($it in $items) {
    $body = @{
        variant = @{
            id = [int64]$it.id
            price = $it.price
            compare_at_price = $it.compare
        }
    } | ConvertTo-Json

    try {
        $res = Invoke-RestMethod -Uri "https://$shop/admin/api/2024-10/variants/$($it.id).json" -Method Put -Headers $headers -Body $body
        Write-Host "Success updating $($it.id): Price = $($res.variant.price), Compare = $($res.variant.compare_at_price)" -ForegroundColor Green
    } catch {
        Write-Host "Error updating $($it.id): $($_.Exception.Message)" -ForegroundColor Red
        if ($_.Exception.Response) {
            $stream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            Write-Host $reader.ReadToEnd()
        }
    }
}
