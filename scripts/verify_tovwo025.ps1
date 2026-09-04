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

$prodQuery = @'
query getProd($id: ID!) {
  product(id: $id) {
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

$res = Invoke-GraphQL -query $prodQuery -variables @{ id = "gid://shopify/Product/9591350657268" }
$p = $res.data.product
Write-Host "Product: $($p.title)" -ForegroundColor Yellow
Write-Host "Media Count: $($p.media.edges.Count)"
$i = 0
foreach ($m in $p.media.edges) {
    Write-Host "  [$i] $($m.node.id) | Alt: $($m.node.alt) | $($m.node.image.url)"
    $i++
}

Write-Host "`nVariants:"
foreach ($v in $p.variants.edges) {
    $opt = ($v.node.selectedOptions | ForEach-Object { "$($_.name)=$($_.value)" }) -join ", "
    Write-Host "  $($v.node.title) [$opt] -> $($v.node.image.url)"
}
