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
    $body = @{ query = $query; variables = $variables } | ConvertTo-Json -Depth 10
    return Invoke-RestMethod -Uri "https://$domain/admin/api/2024-10/graphql.json" -Method Post -Headers $headers -Body $body
}

# Test on TOTM038
# Product ID: gid://shopify/Product/9591352688884
# Move Image 2 (MediaID: gid://shopify/MediaImage/45170782142708) to position "0"

$reorderMutation = @"
mutation productReorderMedia($productId: ID!, $moves: [MoveInput!]!) {
  productReorderMedia(id: $productId, moves: $moves) {
    job {
      id
      done
    }
    userErrors {
      field
      message
    }
  }
}
"@

$variables = @{
    productId = "gid://shopify/Product/9591352688884"
    moves = @(
        @{
            id = "gid://shopify/MediaImage/45170782142708"
            newPosition = "0"
        }
    )
}

$res = Invoke-GraphQL -query $reorderMutation -variables $variables
Write-Host "Reorder response: $($res | ConvertTo-Json -Depth 5)"

# Also update Airforce variants for TOTM038 to mediaId gid://shopify/MediaImage/45170782142708
$variantMutation = @"
mutation productVariantUpdate($input: ProductVariantInput!) {
  productVariantUpdate(input: $input) {
    productVariant {
      id
      mediaId
    }
    userErrors {
      field
      message
    }
  }
}
"@

$varRes = Invoke-GraphQL -query $variantMutation -variables @{
    input = @{
        id = "gid://shopify/ProductVariant/49296594993396" # Airforce / XS
        mediaId = "gid://shopify/MediaImage/45170782142708"
    }
}
Write-Host "Variant update response: $($varRes | ConvertTo-Json -Depth 5)"
