$envContent = Get-Content -Path "c:\Users\HP\Downloads\tokiyo-theme\.env"
$envVars = @{}
foreach ($line in $envContent) {
    if ($line -match '^\s*([^#=]+)=(.*)$') {
        $envVars[$matches[1].Trim()] = $matches[2].Trim()
    }
}
$shop = $envVars["SHOPIFY_STORE_DOMAIN"]
$token = $envVars["SHOPIFY_ACCESS_TOKEN"]

$query = @'
query {
  products(first: 10, query: "tag:bundle") {
    nodes {
      id
      title
      handle
      variants(first: 5) {
        nodes {
          id
          title
          price
          compareAtPrice
          availableForSale
        }
      }
    }
  }
}
'@

$body = @{ query = $query } | ConvertTo-Json
$res = Invoke-RestMethod -Uri "https://$shop/admin/api/2024-10/graphql.json" -Method Post -Headers @{
    "X-Shopify-Access-Token" = $token
    "Content-Type"           = "application/json"
} -Body $body

$res.data.products.nodes | ForEach-Object {
    Write-Host "Product: $($_.title) ($($_.handle))"
    $_.variants.nodes | ForEach-Object {
        Write-Host "  Variant: $($_.id) - Title: $($_.title) - Price: $($_.price) - Compare: $($_.compareAtPrice) - Available: $($_.availableForSale)"
    }
}
