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

$locationId = "gid://shopify/Location/93641441524"
$onlineStorePubId = "gid://shopify/Publication/205598064884"

$bundleDefinitions = @(
    @{
        Title = "Bappa's Blessings: Women's Festive Trio (Buy 3 @ ₹1969)"
        Handle = "womens-festive-trio-buy-3"
        Price = "1969.00"
        CompareAtPrice = "2197.00"
        IncludedCodes = @("TOVWO012", "TOVWO003", "TOVWO005")
        Gender = "Women"
        Quantity = 3
        ImageUrls = @(
            "https://cdn.shopify.com/s/files/1/0837/3292/2612/files/TOVWO012_BL_1.png?v=1788286604",
            "https://cdn.shopify.com/s/files/1/0837/3292/2612/files/TOVWO003_WH_1.png?v=1788286358",
            "https://cdn.shopify.com/s/files/1/0837/3292/2612/files/TOVWO005_PE_1.png?v=1788286424"
        )
        Description = "<p><strong>Festive Special Combo Offer!</strong> Get 3 premium Tokiyo Lifestyle Women's Oversized T-Shirts (TOVWO012 + TOVWO003 + TOVWO005) for just ₹1,969. Select your preferred color and size for each t-shirt below.</p>"
    },
    @{
        Title = "Women's Festive Duo Combo (Buy 2 @ ₹1349)"
        Handle = "womens-festive-duo-buy-2"
        Price = "1349.00"
        CompareAtPrice = "1498.00"
        IncludedCodes = @("TOVWO003", "TOVWO005")
        Gender = "Women"
        Quantity = 2
        ImageUrls = @(
            "https://cdn.shopify.com/s/files/1/0837/3292/2612/files/TOVWO003_WH_1.png?v=1788286358",
            "https://cdn.shopify.com/s/files/1/0837/3292/2612/files/TOVWO005_PE_1.png?v=1788286424"
        )
        Description = "<p><strong>Festive Duo Combo Offer!</strong> Get 2 premium Tokiyo Lifestyle Women's Oversized T-Shirts (TOVWO003 + TOVWO005) for just ₹1,349. Select your preferred color and size for each t-shirt below.</p>"
    },
    @{
        Title = "Men's Festive Duo Combo (Buy 2 @ ₹1269)"
        Handle = "mens-festive-duo-buy-2"
        Price = "1269.00"
        CompareAtPrice = "1408.00"
        IncludedCodes = @("TOTM038", "TOTM008")
        Gender = "Men"
        Quantity = 2
        ImageUrls = @(
            "https://cdn.shopify.com/s/files/1/0837/3292/2612/files/TOTM038_AI_2.png?v=1788285909",
            "https://cdn.shopify.com/s/files/1/0837/3292/2612/files/TOTM008_PE_1.png?v=1788284976"
        )
        Description = "<p><strong>Festive Duo Combo Offer!</strong> Get 2 premium Tokiyo Lifestyle Men's Oversized T-Shirts (TOTM038 + TOTM008) for just ₹1,269. Select your preferred color and size for each t-shirt below.</p>"
    },
    @{
        Title = "Men's Festive Trio Combo (Buy 3 @ ₹1869)"
        Handle = "mens-festive-trio-buy-3"
        Price = "1869.00"
        CompareAtPrice = "2057.00"
        IncludedCodes = @("TOTM038", "TOTM006", "TOTM008")
        Gender = "Men"
        Quantity = 3
        ImageUrls = @(
            "https://cdn.shopify.com/s/files/1/0837/3292/2612/files/TOTM038_AI_2.png?v=1788285909",
            "https://cdn.shopify.com/s/files/1/0837/3292/2612/files/TOTM006_AI_2.png?v=1788284927",
            "https://cdn.shopify.com/s/files/1/0837/3292/2612/files/TOTM008_PE_1.png?v=1788284976"
        )
        Description = "<p><strong>Festive Trio Combo Offer!</strong> Get 3 premium Tokiyo Lifestyle Men's Oversized T-Shirts (TOTM038 + TOTM006 + TOTM008) for just ₹1,869. Select your preferred color and size for each t-shirt below.</p>"
    }
)

foreach ($b in $bundleDefinitions) {
    Write-Host "`n========================================================" -ForegroundColor Cyan
    Write-Host "Processing: $($b.Title)" -ForegroundColor Yellow
    
    # Check if product already exists
    $findQuery = @'
    query FindP($q: String!) {
      products(first: 2, query: $q) {
        edges {
          node {
            id
            handle
            title
          }
        }
      }
    }
'@
    $findRes = Invoke-GraphQL -query $findQuery -variables @{ q = "handle:$($b.Handle)" }
    $existing = $findRes.data.products.edges | Where-Object { $_.node.handle -eq $b.Handle }

    $prodId = $null
    if ($existing) {
        $prodId = $existing.node.id
        Write-Host "Product already exists with ID: $prodId" -ForegroundColor Green
    } else {
        # Create product
        $createProdMutation = @'
        mutation CreateProd($input: ProductCreateInput!) {
          productCreate(product: $input) {
            product {
              id
              handle
            }
            userErrors {
              field
              message
            }
          }
        }
'@
        $pInput = @{
            title = $b.Title
            handle = $b.Handle
            descriptionHtml = $b.Description
            vendor = "TOKIYO LIFESTYLE"
            productType = "Combo Bundle"
            status = "ACTIVE"
            tags = @("bundle", "festive-offer", "combo", $b.Gender.ToLower(), "buy-$($b.Quantity)", "custom-bundle")
        }
        $cRes = Invoke-GraphQL -query $createProdMutation -variables @{ input = $pInput }
        if ($cRes.data.productCreate.userErrors.Count -gt 0) {
            Write-Host "Error creating product: $($cRes.data.productCreate.userErrors | ConvertTo-Json)" -ForegroundColor Red
            continue
        }
        $prodId = $cRes.data.productCreate.product.id
        Write-Host "Created Product ID: $prodId" -ForegroundColor Green
    }

    # Add images
    $mediaInputs = @()
    foreach ($imgUrl in $b.ImageUrls) {
        $mediaInputs += @{
            originalSource = $imgUrl
            mediaContentType = "IMAGE"
            alt = $b.Title
        }
    }

    $createMediaMutation = @'
    mutation CreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
      productCreateMedia(productId: $productId, media: $media) {
        media {
          id
        }
        mediaUserErrors {
          field
          message
        }
      }
    }
'@
    $mRes = Invoke-GraphQL -query $createMediaMutation -variables @{ productId = $prodId; media = $mediaInputs }
    Write-Host "Media attached."

    # Publish to Online Store
    $pubMutation = @'
    mutation Publish($id: ID!, $input: [PublicationInput!]!) {
      publishablePublish(id: $id, input: $input) {
        userErrors {
          field
          message
        }
      }
    }
'@
    $pRes = Invoke-GraphQL -query $pubMutation -variables @{ id = $prodId; input = @(@{ publicationId = $onlineStorePubId }) }
    Write-Host "Published to Online Store."

    # Update variant price
    $getVarsQuery = @'
    query GetV($id: ID!) {
      product(id: $id) {
        variants(first: 5) {
          edges {
            node {
              id
            }
          }
        }
      }
    }
'@
    $vData = Invoke-GraphQL -query $getVarsQuery -variables @{ id = $prodId }
    $firstVarId = $vData.data.product.variants.edges[0].node.id

    $varUpdateMutation = @'
    mutation VarUpdate($input: ProductVariantInput!) {
      productVariantUpdate(input: $input) {
        productVariant {
          id
          price
          compareAtPrice
        }
        userErrors {
          field
          message
        }
      }
    }
'@
    $vuRes = Invoke-GraphQL -query $varUpdateMutation -variables @{
        input = @{
            id = $firstVarId
            price = $b.Price
            compareAtPrice = $b.CompareAtPrice
        }
    }
    Write-Host "Variant Price set to ₹$($b.Price) (Compare: ₹$($b.CompareAtPrice))."
}
