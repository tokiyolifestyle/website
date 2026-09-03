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

$tasks = @(
    @{
        Code = "TOTM038"
        ProductId = "gid://shopify/Product/9591352688884"
        TargetMediaId = "gid://shopify/MediaImage/45170782142708" # TOTM038_AI_2.png
        Color = "Airforce"
        Variants = @(
            "gid://shopify/ProductVariant/49296594993396",
            "gid://shopify/ProductVariant/49296595026164",
            "gid://shopify/ProductVariant/49296595058932",
            "gid://shopify/ProductVariant/49296595091700",
            "gid://shopify/ProductVariant/49296595124468",
            "gid://shopify/ProductVariant/49296595157236"
        )
    },
    @{
        Code = "TOTM043"
        ProductId = "gid://shopify/Product/9591353016564"
        TargetMediaId = "gid://shopify/MediaImage/45170798526708" # TOTM043_BL_2.png
        Color = "Black"
        Variants = @(
            "gid://shopify/ProductVariant/49296597319924",
            "gid://shopify/ProductVariant/49296597352692",
            "gid://shopify/ProductVariant/49296597385460",
            "gid://shopify/ProductVariant/49296597418228",
            "gid://shopify/ProductVariant/49296597450996",
            "gid://shopify/ProductVariant/49296597483764"
        )
    },
    @{
        Code = "TOTM044"
        ProductId = "gid://shopify/Product/9591353082100"
        TargetMediaId = "gid://shopify/MediaImage/45170807439604" # TOTM044_BL_2.png
        Color = "Black"
        Variants = @(
            "gid://shopify/ProductVariant/49071855468788",
            "gid://shopify/ProductVariant/49071855501556",
            "gid://shopify/ProductVariant/49071855534324",
            "gid://shopify/ProductVariant/49071855567092",
            "gid://shopify/ProductVariant/49071855599860",
            "gid://shopify/ProductVariant/49071855632628"
        )
    },
    @{
        Code = "TOTM006"
        ProductId = "gid://shopify/Product/9554551111924"
        TargetMediaId = "gid://shopify/MediaImage/45170678333684" # TOTM006_AI_2.png
        Color = "Airforce"
        Variants = @(
            "gid://shopify/ProductVariant/48862601937140",
            "gid://shopify/ProductVariant/48862601969908",
            "gid://shopify/ProductVariant/48862602002676",
            "gid://shopify/ProductVariant/48862602035444",
            "gid://shopify/ProductVariant/48862602068212",
            "gid://shopify/ProductVariant/48862602100980"
        )
    }
)

foreach ($item in $tasks) {
    Write-Host "`n========================================================" -ForegroundColor Magenta
    Write-Host "Updating $($item.Code) ($($item.Color))..." -ForegroundColor Yellow
    
    # 1. Reorder Media to place target media at index 0
    $reorderVars = @{
        id = $item.ProductId
        moves = @(
            @{
                id = $item.TargetMediaId
                newPosition = "0"
            }
        )
    }
    $rRes = Invoke-GraphQL -query $reorderMutation -variables $reorderVars
    if ($rRes.data.productReorderMedia.userErrors.Count -gt 0) {
        Write-Host "Reorder UserErrors: $($rRes.data.productReorderMedia.userErrors | ConvertTo-Json)" -ForegroundColor Red
    } else {
        Write-Host "Media Reordered: $($item.TargetMediaId) -> Position 0 (Job: $($rRes.data.productReorderMedia.job.id))" -ForegroundColor Green
    }

    # 2. Update Variants
    $variantInputs = @()
    foreach ($vId in $item.Variants) {
        $variantInputs += @{
            id = $vId
            mediaId = $item.TargetMediaId
        }
    }
    $vVars = @{
        productId = $item.ProductId
        variants = $variantInputs
    }
    $vRes = Invoke-GraphQL -query $variantMutation -variables $vVars
    if ($vRes.data.productVariantsBulkUpdate.userErrors.Count -gt 0) {
        Write-Host "Variant Update UserErrors: $($vRes.data.productVariantsBulkUpdate.userErrors | ConvertTo-Json)" -ForegroundColor Red
    } else {
        Write-Host "Updated $($vRes.data.productVariantsBulkUpdate.productVariants.Count) variants for $($item.Color) to media $($item.TargetMediaId)" -ForegroundColor Green
    }
}

Write-Host "`nWaiting 3 seconds for background jobs to complete..."
Start-Sleep -Seconds 3

Write-Host "`n=================== VERIFYING FINAL STATE ===================" -ForegroundColor Cyan
foreach ($item in $tasks) {
    $vQuery = @'
    query CheckProd($id: ID!) {
      product(id: $id) {
        title
        media(first: 5) {
          edges {
            node {
              id
              ... on MediaImage {
                image {
                  url
                }
              }
            }
          }
        }
        variants(first: 10) {
          edges {
            node {
              title
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
    $res = Invoke-GraphQL -query $vQuery -variables @{ id = $item.ProductId }
    $prod = $res.data.product
    Write-Host "`nProduct: $($prod.title)" -ForegroundColor Yellow
    Write-Host "  First Media [0]: $($prod.media.edges[0].node.id) -> $($prod.media.edges[0].node.image.url)" -ForegroundColor Green
    Write-Host "  Second Media [1]: $($prod.media.edges[1].node.id) -> $($prod.media.edges[1].node.image.url)"
    Write-Host "  Sample Variant Image ($($prod.variants.edges[0].node.title)): $($prod.variants.edges[0].node.image.url)" -ForegroundColor Green
}
