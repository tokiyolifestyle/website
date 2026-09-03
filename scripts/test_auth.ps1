$envContent = Get-Content -Path "c:\Users\HP\Downloads\tokiyo-theme\.env"
$envVars = @{}
foreach ($line in $envContent) {
    if ($line -match '^\s*([^#=]+)=(.*)$') {
        $envVars[$matches[1].Trim()] = $matches[2].Trim()
    }
}

$domain = $envVars["SHOPIFY_STORE_DOMAIN"]
$token = $envVars["SHOPIFY_ACCESS_TOKEN"]
$clientId = $envVars["SHOPIFY_CLIENT_ID"]
$clientSecret = $envVars["SHOPIFY_CLIENT_SECRET"]

# If token fails or is expired, exchange credentials
function Get-ActiveToken {
    if ($token -and $token.StartsWith("shpat_") -and -not $token.Contains("PASTE_YOUR_ADMIN")) {
        return $token
    }
    $body = @{
        grant_type = "client_credentials"
        client_id = $clientId
        client_secret = $clientSecret
    }
    $res = Invoke-RestMethod -Uri "https://$domain/admin/oauth/access_token" -Method Post -Body $body
    return $res.access_token
}

$activeToken = Get-ActiveToken
Write-Host "Domain: $domain"
Write-Host "Active Token Prefix: $($activeToken.Substring(0, 10))..."

$query = @"
query {
  products(first: 50) {
    edges {
      node {
        id
        title
        handle
      }
    }
  }
}
"@

$body = @{ query = $query } | ConvertTo-Json
$headers = @{
    "Content-Type" = "application/json"
    "X-Shopify-Access-Token" = $activeToken
}

$response = Invoke-RestMethod -Uri "https://$domain/admin/api/2024-10/graphql.json" -Method Post -Headers $headers -Body $body
Write-Host "Found $($response.data.products.edges.Count) products total."
$response.data.products.edges | ForEach-Object {
    if ($_.node.title -match "TOTM038|TOTM043|TOTM044|TOTM006") {
        Write-Host "Match: $($_.node.title) (ID: $($_.node.id), Handle: $($_.node.handle))" -ForegroundColor Green
    }
}
