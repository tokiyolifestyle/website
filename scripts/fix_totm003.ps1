$envContent = Get-Content -Path "c:\Users\HP\Downloads\tokiyo-theme\.env"
$envVars = @{}
foreach ($line in $envContent) {
    if ($line -match '^\s*([^#=]+)=(.*)$') {
        $envVars[$matches[1].Trim()] = $matches[2].Trim()
    }
}

$domain = $envVars["SHOPIFY_STORE_DOMAIN"]
$token = $envVars["SHOPIFY_ACCESS_TOKEN"]
$headers = @{
    "Content-Type" = "application/json"
    "X-Shopify-Access-Token" = $token
}

function Invoke-GraphQL($query, $variables = @{}) {
    $payload = @{ query = $query; variables = $variables }
    $body = $payload | ConvertTo-Json -Depth 10
    $res = Invoke-RestMethod -Uri "https://$domain/admin/api/2024-10/graphql.json" -Method Post -Headers $headers -Body $body
    return $res
}

$variantMutation = @'
mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
  productVariantsBulkUpdate(productId: $productId, variants: $variants) {
    productVariants {
      id
      title
      image {
        id
        url
      }
    }
    userErrors {
      field
      message
    }
  }
}
'@

$productId = "gid://shopify/Product/9554550915316"

$variants = @(
    # Beige variants -> TOTM003_BE_1.png (Media ID: gid://shopify/MediaImage/45170660442356)
    @{ id = "gid://shopify/ProductVariant/48862597841140"; mediaId = "gid://shopify/MediaImage/45170660442356" },
    @{ id = "gid://shopify/ProductVariant/48862597873908"; mediaId = "gid://shopify/MediaImage/45170660442356" },
    @{ id = "gid://shopify/ProductVariant/48862597906676"; mediaId = "gid://shopify/MediaImage/45170660442356" },
    @{ id = "gid://shopify/ProductVariant/48862597939444"; mediaId = "gid://shopify/MediaImage/45170660442356" },
    @{ id = "gid://shopify/ProductVariant/48862597972212"; mediaId = "gid://shopify/MediaImage/45170660442356" },
    @{ id = "gid://shopify/ProductVariant/48862598004980"; mediaId = "gid://shopify/MediaImage/45170660442356" },
    
    # Peach variants -> TOTM003_PE_1.png (Media ID: gid://shopify/MediaImage/45170662998260)
    @{ id = "gid://shopify/ProductVariant/48862598234356"; mediaId = "gid://shopify/MediaImage/45170662998260" },
    @{ id = "gid://shopify/ProductVariant/48862598267124"; mediaId = "gid://shopify/MediaImage/45170662998260" },
    @{ id = "gid://shopify/ProductVariant/48862598299892"; mediaId = "gid://shopify/MediaImage/45170662998260" },
    @{ id = "gid://shopify/ProductVariant/48862598332660"; mediaId = "gid://shopify/MediaImage/45170662998260" },
    @{ id = "gid://shopify/ProductVariant/48862598365428"; mediaId = "gid://shopify/MediaImage/45170662998260" },
    @{ id = "gid://shopify/ProductVariant/48862598398196"; mediaId = "gid://shopify/MediaImage/45170662998260" },

    # Pista variants -> TOTM003_PI_1.png (Media ID: gid://shopify/MediaImage/45170664964340)
    @{ id = "gid://shopify/ProductVariant/48862598037748"; mediaId = "gid://shopify/MediaImage/45170664964340" },
    @{ id = "gid://shopify/ProductVariant/48862598070516"; mediaId = "gid://shopify/MediaImage/45170664964340" },
    @{ id = "gid://shopify/ProductVariant/48862598103284"; mediaId = "gid://shopify/MediaImage/45170664964340" },
    @{ id = "gid://shopify/ProductVariant/48862598136052"; mediaId = "gid://shopify/MediaImage/45170664964340" },
    @{ id = "gid://shopify/ProductVariant/48862598168820"; mediaId = "gid://shopify/MediaImage/45170664964340" },
    @{ id = "gid://shopify/ProductVariant/48862598201588"; mediaId = "gid://shopify/MediaImage/45170664964340" }
)

$vVars = @{
    productId = $productId
    variants = $variants
}

$vRes = Invoke-GraphQL -query $variantMutation -variables $vVars
if ($vRes.data.productVariantsBulkUpdate.userErrors.Count -gt 0) {
    Write-Host "Variant Update UserErrors: $($vRes.data.productVariantsBulkUpdate.userErrors | ConvertTo-Json)" -ForegroundColor Red
} else {
    Write-Host "Successfully updated all $($vRes.data.productVariantsBulkUpdate.productVariants.Count) variants for TOTM003!" -ForegroundColor Green
    foreach ($pv in $vRes.data.productVariantsBulkUpdate.productVariants) {
        Write-Host "  $($pv.title) -> $($pv.image.url)"
    }
}
