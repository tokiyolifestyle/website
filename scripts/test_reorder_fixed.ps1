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

# Check reorder mutation schema
$reorderMutation = @'
mutation productReorderMedia($id: ID!, $moves: [MoveInput!]!) {
  productReorderMedia(id: $id, moves: $moves) {
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
'@

$variables = @{
    id = "gid://shopify/Product/9591352688884"
    moves = @(
        @{
            id = "gid://shopify/MediaImage/45170782142708"
            newPosition = "0"
        }
    )
}

$res = Invoke-GraphQL -query $reorderMutation -variables $variables
Write-Host "Reorder response:"
$res | ConvertTo-Json -Depth 5
