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

$allProducts = @()
$cursor = $null

do {
    $afterParam = if ($cursor) { ", after: `"$cursor`"" } else { "" }
    $query = @"
    query {
      products(first: 100$afterParam) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            id
            title
            handle
            media(first: 20) {
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
                      originalSrc
                    }
                  }
                }
              }
            }
            variants(first: 20) {
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
    $body = @{ query = $query } | ConvertTo-Json
    $response = Invoke-RestMethod -Uri "https://$domain/admin/api/2024-10/graphql.json" -Method Post -Headers $headers -Body $body
    $edges = $response.data.products.edges
    $allProducts += $edges
    $hasNext = $response.data.products.pageInfo.hasNextPage
    $cursor = $response.data.products.pageInfo.endCursor
} while ($hasNext)

Write-Host "Total products retrieved: $($allProducts.Count)"

$targets = @("TOTM038", "TOTM043", "TOTM044", "TOTM006")

foreach ($t in $targets) {
    Write-Host "`n=======================================================" -ForegroundColor Magenta
    Write-Host "SEARCHING FOR: $t" -ForegroundColor Yellow
    $found = $allProducts | Where-Object { $_.node.title -match "$t\b" -or $_.node.handle -match "$t" }
    if (-not $found) {
        Write-Host "NOT FOUND: $t" -ForegroundColor Red
        continue
    }
    foreach ($p in $found) {
        $node = $p.node
        Write-Host "Product: $($node.title)" -ForegroundColor Green
        Write-Host "ID: $($node.id)"
        Write-Host "Handle: $($node.handle)"
        Write-Host "Media count: $($node.media.edges.Count)"
        $idx = 0
        foreach ($m in $node.media.edges) {
            Write-Host "  Image [$idx]: MediaID=$($m.node.id), ImageID=$($m.node.image.id)"
            Write-Host "    URL: $($m.node.image.url)"
            $idx++
        }
        Write-Host "Variants count: $($node.variants.edges.Count)"
        foreach ($v in $node.variants.edges) {
            $optStr = ($v.node.selectedOptions | ForEach-Object { "$($_.name)=$($_.value)" }) -join ", "
            Write-Host "  Variant: $($v.node.title) [$optStr] -> Image ID: $($v.node.image.id)"
        }
    }
}
