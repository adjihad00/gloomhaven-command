# Certbot renewal script for game.gh-command.com
# Run as Administrator via scheduled task or manually
# Renews Let's Encrypt cert, copies from archive to live, restarts server

$certbot = "C:\Users\Kyle Diaz\AppData\Local\Python\pythoncore-3.14-64\Scripts\certbot.exe"
$domain = "game.gh-command.com"
$archiveDir = "C:\Certbot\archive\$domain"
$liveDir = "C:\Certbot\live\$domain"
$logFile = "C:\Certbot\renewal.log"

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Add-Content -Path $logFile -Value "[$timestamp] Starting renewal check for $domain"

# Run certbot renew (only renews if within 30 days of expiry, unless --force-renewal)
& $certbot renew --cert-name $domain 2>&1 | Out-File -Append -FilePath $logFile

# Find the latest archive files (highest numbered)
$certs = Get-ChildItem "$archiveDir\fullchain*.pem" | Sort-Object Name | Select-Object -Last 1
$keys = Get-ChildItem "$archiveDir\privkey*.pem" | Sort-Object Name | Select-Object -Last 1

if ($certs -and $keys) {
    # Stop any node server holding the cert files
    $nodeProcs = Get-Process -Name "node" -ErrorAction SilentlyContinue
    if ($nodeProcs) {
        Add-Content -Path $logFile -Value "[$timestamp] Stopping node processes..."
        Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
    }

    # Copy latest archive certs to live directory
    Copy-Item -Path $certs.FullName -Destination "$liveDir\fullchain.pem" -Force
    Copy-Item -Path $keys.FullName -Destination "$liveDir\privkey.pem" -Force

    $certSize = (Get-Item "$liveDir\fullchain.pem").Length
    $keySize = (Get-Item "$liveDir\privkey.pem").Length
    Add-Content -Path $logFile -Value "[$timestamp] Certs copied: fullchain=${certSize}B, privkey=${keySize}B"

    if ($certSize -eq 0 -or $keySize -eq 0) {
        Add-Content -Path $logFile -Value "[$timestamp] ERROR: Cert files are empty after copy!"
    } else {
        Add-Content -Path $logFile -Value "[$timestamp] Renewal complete."
    }
} else {
    Add-Content -Path $logFile -Value "[$timestamp] ERROR: Could not find archive cert files in $archiveDir"
}
