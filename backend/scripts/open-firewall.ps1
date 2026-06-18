# Run as Administrator to open port 3000 for incoming TCP traffic
param(
  [int]$Port = 3000,
  [string]$RuleName = "Soundwave API port 3000"
)

Write-Host "Creating firewall rule to allow TCP port $Port"

# Check if rule exists
$existing = Get-NetFirewallRule -DisplayName $RuleName -ErrorAction SilentlyContinue
if ($existing) {
  Write-Host "Firewall rule '$RuleName' already exists."
  exit 0
}

New-NetFirewallRule -DisplayName $RuleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort $Port -Profile Any
Write-Host "Firewall rule created. Port $Port allowed inbound."
