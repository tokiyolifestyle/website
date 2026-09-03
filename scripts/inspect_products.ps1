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

$query = @"
query GetProducts {
  products(first: 10, query: "title:TOTM038 OR title:TOTM043 OR title:TOTM044 OR title:TOTM006") {
    edges {
      node {
        id
        title
        handle
        media(first: 10) {
          edges {
            node {
              id
              mediaContentType
              alt
              ... on MediaImage {
                image {
                  id
                  url
                  altText
                }
              }
            }
          }
        }
        variants(first: 10) {
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
  }
}
"@

$body = @{ query = $query } | ConvertTo-Json -Depth 10

$response = Invoke-RestMethod -Uri "https://$domain/admin/api/2024-10/graphql.json" -Method Post -Headers $headers -Body $body
$response.data.products.edges | ForEach-Object {
    $p = $_.node
    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host "Product: $($p.title) ($($p.id))" -ForegroundColor Yellow
    Write-Host "Handle: $($p.handle)"
    Write-Host "Media Count: $($p.media.edges.Count)"
    $idx = 0
    foreach ($m in $p.media.edges) {
        Write-Host "  [$idx] Media ID: $($m.node.id) | Image ID: $($m.node.image.id) | URL: $($m.node.image.url)"
        $idx++
    }
    Write-Host "Variants:"
    foreach ($v in $p.variants.edges) {
        Write-Host "  Variant: $($v.node.title) (ID: $($v.node.id)) | Assigned Image ID: $($v.node.image.id)"
    }
}
