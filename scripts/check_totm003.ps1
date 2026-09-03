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

$query = @'
query {
  product(id: "gid://shopify/Product/9554550915316") {
    id
    title
    media(first: 30) {
      edges {
        node {
          id
          alt
          ... on MediaImage {
            image {
              id
              url
            }
          }
        }
      }
    }
    variants(first: 30) {
      edges {
        node {
          id
          title
          selectedOptions {
            name
            value
          }
          image {
            id
            url
          }
        }
      }
    }
  }
}
'@

$res = Invoke-GraphQL -query $query
$p = $res.data.product
Write-Host "Product: $($p.title)"
Write-Host "`nMedia:"
foreach ($m in $p.media.edges) {
    Write-Host "  $($m.node.id) | Alt: $($m.node.alt) | $($m.node.image.url)"
}

Write-Host "`nVariants:"
foreach ($v in $p.variants.edges) {
    Write-Host "  ID: $($v.node.id) | Title: $($v.node.title) | Image: $($v.node.image.url)"
}
