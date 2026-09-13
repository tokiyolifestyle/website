$envContent = Get-Content -Path "c:\Users\HP\Downloads\tokiyo-theme\.env"
$envVars = @{}
foreach ($line in $envContent) {
    if ($line -match '^\s*([^#=]+)=(.*)$') {
        $envVars[$matches[1].Trim()] = $matches[2].Trim()
    }
}

$domain = $envVars["SHOPIFY_STORE_DOMAIN"]
$token = $envVars["SHOPIFY_ACCESS_TOKEN"]
$onlineStorePubId = "gid://shopify/Publication/205598064884"

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

$combos = @(
    @{
        Title = "Lovebird's Pick: TOTM003 + TOVWO001 (Pick Any 2 @ ₹1,299)"
        Handle = "lovebirds-pick-totm003-tovwo001"
        Price = "1299.00"
        CompareAtPrice = "1498.00"
        Description = "<p><strong>Lovebird's Special: Pick Any 2 @ ₹1,299</strong></p><p>Featuring Men's TOTM003 + Women's TOVWO001. Choose your preferred color and size for each tee.</p>"
        ImagePath = "C:\Users\HP\Downloads\TOTM003 + TOVWO001.png"
        Filename = "lovebirds_totm003_tovwo001.png"
        MimeType = "image/png"
        Items = @("tokiyo-lifestyle-oversized-t-shirt-totm003", "tokiyo-lifestyle-women-oversized-t-shirt-tovwo001")
    },
    @{
        Title = "Lovebird's Pick: TOTM044 + TOVWO011 (Pick Any 2 @ ₹1,349)"
        Handle = "lovebirds-pick-totm044-tovwo011"
        Price = "1349.00"
        CompareAtPrice = "1598.00"
        Description = "<p><strong>Lovebird's Special: Pick Any 2 @ ₹1,349</strong></p><p>Featuring Men's TOTM044 + Women's TOVWO011. Choose your preferred color and size for each tee.</p>"
        ImagePath = "C:\Users\HP\Downloads\TOTM044 + TOVWO011.jpeg"
        Filename = "lovebirds_totm044_tovwo011.jpeg"
        MimeType = "image/jpeg"
        Items = @("tokiyo-lifestyle-oversized-t-shirt-totm044", "tokiyo-lifestyle-women-oversized-t-shirt-tovwo011")
    },
    @{
        Title = "Lovebird's Pick: TOTM039 + TOVWO015 (Pick Any 2 @ ₹1,299)"
        Handle = "lovebirds-pick-totm039-tovwo015"
        Price = "1299.00"
        CompareAtPrice = "1498.00"
        Description = "<p><strong>Lovebird's Special: Pick Any 2 @ ₹1,299</strong></p><p>Featuring Men's TOTM039 + Women's TOVWO015. Choose your preferred color and size for each tee.</p>"
        ImagePath = "C:\Users\HP\Downloads\TOTM039 + TOVWO015.png"
        Filename = "lovebirds_totm039_tovwo015.png"
        MimeType = "image/png"
        Items = @("tokiyo-lifestyle-oversized-t-shirt-totm039", "tokiyo-lifestyle-women-oversized-t-shirt-tovwo015")
    }
)

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "1. Staged Upload for 3 Lovebird Combo Images" -ForegroundColor Yellow

$stagedInputs = @()
foreach ($c in $combos) {
    $stagedInputs += @{
        filename = $c.Filename
        mimeType = $c.MimeType
        resource = "IMAGE"
        httpMethod = "POST"
    }
}

$stageMutation = @'
mutation generateStagedUploads($input: [StagedUploadInput!]!) {
  stagedUploadsCreate(input: $input) {
    stagedTargets {
      url
      resourceUrl
      parameters {
        name
        value
      }
    }
    userErrors {
      field
      message
    }
  }
}
'@

$stageRes = Invoke-GraphQL -query $stageMutation -variables @{ input = $stagedInputs }
$targets = $stageRes.data.stagedUploadsCreate.stagedTargets
Write-Host "Got $($targets.Count) staged targets."

$uploadedUrls = @()
for ($i = 0; $i -lt $combos.Count; $i++) {
    $c = $combos[$i]
    $target = $targets[$i]
    Write-Host "Uploading $($c.Filename)..."
    
    $curlArgs = @("-s", "-i", "-X", "POST")
    foreach ($p in $target.parameters) {
        $curlArgs += "-F"
        $curlArgs += "$($p.name)=$($p.value)"
    }
    $curlArgs += "-F"
    $curlArgs += "file=@$($c.ImagePath);type=$($c.MimeType)"
    $curlArgs += $target.url
    
    $curlOutput = & "C:\Windows\System32\curl.exe" @curlArgs
    $statusLine = $curlOutput | Where-Object { $_ -match "^HTTP/" } | Select-Object -Last 1
    Write-Host "  Result: $statusLine" -ForegroundColor Green
    $c["ResourceUrl"] = $target.resourceUrl
}

Write-Host "`n=============================================" -ForegroundColor Cyan
Write-Host "2. Creating / Updating 3 Lovebird Bundle Products" -ForegroundColor Yellow

foreach ($c in $combos) {
    Write-Host "`n--- Processing $($c.Handle) ---"
    
    # Check if product exists
    $findQ = @'
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
    $findRes = Invoke-GraphQL -query $findQ -variables @{ q = "handle:$($c.Handle)" }
    $existing = $findRes.data.products.edges | Where-Object { $_.node.handle -eq $c.Handle }
    
    $prodId = $null
    if ($existing) {
        $prodId = $existing.node.id
        Write-Host "Product exists: $prodId" -ForegroundColor Green
    } else {
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
            title = $c.Title
            handle = $c.Handle
            descriptionHtml = $c.Description
            vendor = "TOKIYO LIFESTYLE"
            productType = "Combo Bundle"
            status = "ACTIVE"
            tags = @("bundle", "festive-offer", "combo", "lovebirds-pick", "custom-bundle")
        }
        $cRes = Invoke-GraphQL -query $createProdMutation -variables @{ input = $pInput }
        if ($cRes.data.productCreate.userErrors.Count -gt 0) {
            Write-Host "Create Error: $($cRes.data.productCreate.userErrors | ConvertTo-Json)" -ForegroundColor Red
            continue
        }
        $prodId = $cRes.data.productCreate.product.id
        Write-Host "Created Product ID: $prodId" -ForegroundColor Green
    }
    
    # Attach Image
    if ($c.ResourceUrl) {
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
        $mInput = @(@{
            originalSource = $c.ResourceUrl
            mediaContentType = "IMAGE"
            alt = $c.Title
        })
        $mRes = Invoke-GraphQL -query $createMediaMutation -variables @{ productId = $prodId; media = $mInput }
        Write-Host "Image attached."
    }
    
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
    
    # Set templateSuffix: "bundle"
    $updateProdMutation = @'
    mutation UpdateProdTemplate($input: ProductInput!) {
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
    $uRes = Invoke-GraphQL -query $updateProdMutation -variables @{ input = @{ id = $prodId; templateSuffix = "bundle" } }
    Write-Host "Set templateSuffix to 'bundle'."
    
    # Get variant ID
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
    $variantGid = $vData.data.product.variants.edges[0].node.id
    $varNumId = $variantGid -replace 'gid://shopify/ProductVariant/', ''
    
    # Update variant price & inventory via REST API
    $varBody = @{
        variant = @{
            id = [int64]$varNumId
            price = $c.Price
            compare_at_price = $c.CompareAtPrice
            inventory_management = $null
            inventory_policy = "continue"
        }
    } | ConvertTo-Json
    
    $restRes = Invoke-RestMethod -Uri "https://$domain/admin/api/2024-10/variants/$varNumId.json" -Method Put -Headers $headers -Body $varBody
    Write-Host "Variant price set to Rs $($restRes.variant.price) (Compare: Rs $($restRes.variant.compare_at_price)), policy: continue." -ForegroundColor Green
    
    # Fetch final product info with image URL
    $finalQ = @'
    query FinalP($id: ID!) {
      product(id: $id) {
        featuredImage {
          url
        }
      }
    }
'@
    $fRes = Invoke-GraphQL -query $finalQ -variables @{ id = $prodId }
    $c["FinalImageUrl"] = $fRes.data.product.featuredImage.url
    Write-Host "Featured Image URL: $($c.FinalImageUrl)"
}

Write-Host "`nAll 3 Lovebird Combos created & configured successfully!" -ForegroundColor Green
$combos | Select-Object Title, Handle, Price, CompareAtPrice, FinalImageUrl | Format-List
