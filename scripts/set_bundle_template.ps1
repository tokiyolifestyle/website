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

$handles = @(
    "womens-festive-trio-buy-3",
    "womens-festive-duo-buy-2",
    "mens-festive-duo-buy-2",
    "mens-festive-trio-buy-3"
)

$findQuery = @'
query FindP($q: String!) {
  products(first: 10, query: $q) {
    edges {
      node {
        id
        handle
      }
    }
  }
}
'@

$res = Invoke-GraphQL -query $findQuery -variables @{ q = "tag:bundle" }
$updateMutation = @'
mutation UpdateSuffix($input: ProductInput!) {
  productUpdate(input: $input) {
    product {
      id
      templateSuffix
    }
    userErrors {
      field
      message
    }
  }
}
'@

foreach ($edge in $res.data.products.edges) {
    $p = $edge.node
    if ($handles -contains $p.handle) {
        $uRes = Invoke-GraphQL -query $updateMutation -variables @{
            input = @{
                id = $p.id
                templateSuffix = "bundle"
            }
        }
        Write-Host "Updated $($p.handle) templateSuffix to 'bundle'" -ForegroundColor Green
    }
}
