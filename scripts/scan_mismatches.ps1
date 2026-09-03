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
                    altText
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

Write-Host "Scanned $($allProducts.Count) products for variant image mismatches:`n"

foreach ($p in $allProducts) {
    $node = $p.node
    $hasMismatch = $false
    foreach ($v in $node.variants.edges) {
        $colorOpt = $v.node.selectedOptions | Where-Object { $_.name -eq "Color" }
        if ($colorOpt -and $v.node.image) {
            $cVal = $colorOpt.value.ToLower().Replace(" ", "").Replace("-", "")
            $imgUrl = $v.node.image.url.ToLower()
            $imgAlt = if ($v.node.image.altText) { $v.node.image.altText.ToLower() } else { "" }
            
            # check common color abbreviations or names in filename
            # e.g., beige -> _be_, peach -> _pe_, pista -> _pi_, black -> _bl_, airforce -> _ai_, etc.
            if ($imgUrl -match "_([a-z]{2})_" -or $imgAlt -ne "") {
                # Let's check if the variant title color does not match
            }
        }
    }
}
