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

$productId = "gid://shopify/Product/9591350657268"
$airforceDir = "C:\Users\HP\Downloads\Tokiyo final imageds\Woman_s Oversize\TOVWO025\TOVWO025_AI"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "UPDATING TOVWO025 AIRFORCE IMAGES" -ForegroundColor Yellow
Write-Host "Product ID: $productId"
Write-Host "Folder: $airforceDir"

# Step 1: Create Staged Upload targets for 1.png, 2.png, 3.png, 4.png
$filesToUpload = @("1.png", "2.png", "3.png", "4.png")
$stagedInputs = @()

foreach ($f in $filesToUpload) {
    $stagedInputs += @{
        filename = "TOVWO025_AI_$f"
        mimeType = "image/png"
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

Write-Host "`n1. Generating Staged Upload targets..." -ForegroundColor Yellow
$stageRes = Invoke-GraphQL -query $stageMutation -variables @{ input = $stagedInputs }
if ($stageRes.data.stagedUploadsCreate.userErrors.Count -gt 0) {
    Write-Host "Staged Upload Error: $($stageRes.data.stagedUploadsCreate.userErrors | ConvertTo-Json)" -ForegroundColor Red
    exit 1
}

$targets = $stageRes.data.stagedUploadsCreate.stagedTargets
Write-Host "Generated $($targets.Count) staged upload targets." -ForegroundColor Green

# Step 2: Upload files via curl.exe
$uploadedResourceUrls = @()
for ($i = 0; $i -lt $filesToUpload.Count; $i++) {
    $fileName = $filesToUpload[$i]
    $filePath = Join-Path $airforceDir $fileName
    $target = $targets[$i]
    
    Write-Host "Uploading $fileName -> $($target.resourceUrl)..."
    $curlArgs = @("-s", "-i", "-X", "POST")
    foreach ($p in $target.parameters) {
        $curlArgs += "-F"
        $curlArgs += "$($p.name)=$($p.value)"
    }
    $curlArgs += "-F"
    $curlArgs += "file=@$filePath;type=image/png"
    $curlArgs += $target.url
    
    $curlOutput = & "C:\Windows\System32\curl.exe" @curlArgs
    $statusLine = $curlOutput | Where-Object { $_ -match "^HTTP/" } | Select-Object -Last 1
    Write-Host "  Upload result: $statusLine" -ForegroundColor Green
    $uploadedResourceUrls += $target.resourceUrl
}

# Step 3: Attach new media to product
Write-Host "`n2. Attaching new media to product..." -ForegroundColor Yellow
$mediaInputs = @()
foreach ($rUrl in $uploadedResourceUrls) {
    $mediaInputs += @{
        originalSource = $rUrl
        mediaContentType = "IMAGE"
        alt = "Airforce"
    }
}

$createMediaMutation = @'
mutation productCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
  productCreateMedia(productId: $productId, media: $media) {
    media {
      id
      alt
      status
    }
    mediaUserErrors {
      field
      message
    }
  }
}
'@

$mediaRes = Invoke-GraphQL -query $createMediaMutation -variables @{ productId = $productId; media = $mediaInputs }
if ($mediaRes.data.productCreateMedia.mediaUserErrors.Count -gt 0) {
    Write-Host "Create Media Errors: $($mediaRes.data.productCreateMedia.mediaUserErrors | ConvertTo-Json)" -ForegroundColor Red
    exit 1
}

$newMediaList = $mediaRes.data.productCreateMedia.media
Write-Host "Created $($newMediaList.Count) new media items:" -ForegroundColor Green
foreach ($m in $newMediaList) {
    Write-Host "  New Media ID: $($m.id) (Status: $($m.status))"
}

# Step 4: Wait 5 seconds for media to process on Shopify CDN
Write-Host "`n3. Waiting 5 seconds for media ingestion..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Step 5: Query current product state to get new image URLs & IDs
$prodQuery = @'
query getProd($id: ID!) {
  product(id: $id) {
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
        }
      }
    }
  }
}
'@

$prodData = Invoke-GraphQL -query $prodQuery -variables @{ id = $productId }
$currentMedia = $prodData.data.product.media.edges | ForEach-Object { $_.node }
Write-Host "Current total media count: $($currentMedia.Count)"

# Identify new Airforce media and old Airforce media
$newMediaIds = $newMediaList | ForEach-Object { $_.id }
$oldAirforceMediaIds = @(
    "gid://shopify/MediaImage/45170929238260",
    "gid://shopify/MediaImage/45170929664244",
    "gid://shopify/MediaImage/45170929991924",
    "gid://shopify/MediaImage/45170930483444"
)

# Step 6: Update Airforce variants to point to the new 1st Airforce image ($newMediaIds[0])
Write-Host "`n4. Updating Airforce variants to new primary image ($($newMediaIds[0]))..." -ForegroundColor Yellow
$airforceVariants = $prodData.data.product.variants.edges | Where-Object {
    ($_.node.selectedOptions | Where-Object { $_.name -eq "Color" -and $_.value -eq "Airforce" })
}

$variantUpdates = @()
foreach ($v in $airforceVariants) {
    $variantUpdates += @{
        id = $v.node.id
        mediaId = $newMediaIds[0]
    }
}

$variantBulkMutation = @'
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

$vRes = Invoke-GraphQL -query $variantBulkMutation -variables @{ productId = $productId; variants = $variantUpdates }
if ($vRes.data.productVariantsBulkUpdate.userErrors.Count -gt 0) {
    Write-Host "Variant Update Errors: $($vRes.data.productVariantsBulkUpdate.userErrors | ConvertTo-Json)" -ForegroundColor Red
} else {
    Write-Host "Successfully updated $($vRes.data.productVariantsBulkUpdate.productVariants.Count) Airforce variants." -ForegroundColor Green
}

# Step 7: Delete old Airforce media
Write-Host "`n5. Deleting old Airforce media items..." -ForegroundColor Yellow
$deleteMediaMutation = @'
mutation productDeleteMedia($productId: ID!, $mediaIds: [ID!]!) {
  productDeleteMedia(productId: $productId, mediaIds: $mediaIds) {
    deletedMediaIds
    mediaUserErrors {
      field
      message
    }
  }
}
'@

$delRes = Invoke-GraphQL -query $deleteMediaMutation -variables @{ productId = $productId; mediaIds = $oldAirforceMediaIds }
if ($delRes.data.productDeleteMedia.mediaUserErrors.Count -gt 0) {
    Write-Host "Delete Media Errors: $($delRes.data.productDeleteMedia.mediaUserErrors | ConvertTo-Json)" -ForegroundColor Red
} else {
    Write-Host "Deleted old media IDs: $($delRes.data.productDeleteMedia.deletedMediaIds -join ', ')" -ForegroundColor Green
}

# Step 8: Reorder media so new Airforce images are at positions 0, 1, 2, 3
Write-Host "`n6. Ordering media so Airforce images come first (positions 0, 1, 2, 3)..." -ForegroundColor Yellow
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

$moves = @()
for ($mIdx = 0; $mIdx -lt $newMediaIds.Count; $mIdx++) {
    $moves += @{
        id = $newMediaIds[$mIdx]
        newPosition = "$mIdx"
    }
}

$reorderRes = Invoke-GraphQL -query $reorderMutation -variables @{ id = $productId; moves = $moves }
Write-Host "Reorder response: $($reorderRes | ConvertTo-Json -Depth 3)"

# Step 9: Final Verification
Write-Host "`n7. Final Verification of TOVWO025..." -ForegroundColor Cyan
Start-Sleep -Seconds 3

$finalProd = Invoke-GraphQL -query $prodQuery -variables @{ id = $productId }
Write-Host "`nProduct: $($finalProd.data.product.media.edges.Count) media items"
$idx = 0
foreach ($m in $finalProd.data.product.media.edges) {
    Write-Host "  [$idx] $($m.node.id) | Alt: $($m.node.alt) | $($m.node.image.url)"
    $idx++
}

Write-Host "`nVariants:"
foreach ($v in $finalProd.data.product.variants.edges) {
    $optStr = ($v.node.selectedOptions | ForEach-Object { "$($_.name)=$($_.value)" }) -join ", "
    Write-Host "  $($v.node.title) [$optStr] -> $($v.node.image.url)"
}
