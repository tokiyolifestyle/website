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

$mutation = @'
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

$variants = @(
    @{ id = "gid://shopify/ProductVariant/49296594993396"; mediaId = "gid://shopify/MediaImage/45170782142708" },
    @{ id = "gid://shopify/ProductVariant/49296595026164"; mediaId = "gid://shopify/MediaImage/45170782142708" },
    @{ id = "gid://shopify/ProductVariant/49296595058932"; mediaId = "gid://shopify/MediaImage/45170782142708" },
    @{ id = "gid://shopify/ProductVariant/49296595091700"; mediaId = "gid://shopify/MediaImage/45170782142708" },
    @{ id = "gid://shopify/ProductVariant/49296595124468"; mediaId = "gid://shopify/MediaImage/45170782142708" },
    @{ id = "gid://shopify/ProductVariant/49296595157236"; mediaId = "gid://shopify/MediaImage/45170782142708" }
)

$variables = @{
    productId = "gid://shopify/Product/9591352688884"
    variants = $variants
}

$res = Invoke-GraphQL -query $mutation -variables $variables
Write-Host "Variant update response:"
$res | ConvertTo-Json -Depth 5
