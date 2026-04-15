# HTTPS + LAN Access Setup

How to access Gloomhaven Command from all devices on the LAN via
`https://game.gh-command.com:3000`.

## Architecture

```
Cloudflare DNS:  game.gh-command.com → 192.168.50.96 (LAN IP)
Let's Encrypt:   TLS cert for game.gh-command.com (auto-renewed via certbot)
Server:          Node.js HTTPS on 0.0.0.0:3000, cert auto-discovered from C:\Certbot\live\
```

Devices on the LAN access the server via the public domain name, which resolves
to the private LAN IP. The Let's Encrypt cert makes HTTPS work without browser
warnings on all devices (no mkcert CA installation needed).

## DNS Resolution

### Problem: Router DNS Rebinding Protection

Most modern routers (including ASUS GT-AX11000 Pro) block DNS responses that
resolve public domain names to private IP addresses (192.168.x.x). This is a
security feature called **DNS rebinding protection**. It silently drops the
Cloudflare DNS response, making `game.gh-command.com` unresolvable from the LAN.

### Fix: Router /etc/hosts Entry via SSH (ASUS GT-AX11000 Pro)

The ASUS firmware does NOT auto-include `/jffs/configs/dnsmasq.conf.add` —
the generated `/etc/dnsmasq.conf` has no `conf-file` or `conf-dir` directive
for it. The `address=` directive in that file is silently ignored.

Instead, add the entry to `/etc/hosts` (which dnsmasq DOES load via
`addn-hosts=/etc/hosts`) and signal dnsmasq to reload without a full restart
(full restart regenerates `/etc/hosts` and wipes the entry):

```bash
ssh Admin@192.168.50.1
echo "192.168.50.96 game.gh-command.com" >> /etc/hosts
kill -HUP $(pidof dnsmasq)
```

To survive reboots, a startup script re-adds the entry after the firmware
regenerates `/etc/hosts`:

```bash
cat > /jffs/scripts/services-start << 'EOF'
#!/bin/sh
echo "192.168.50.96 game.gh-command.com" >> /etc/hosts
kill -HUP $(pidof dnsmasq)
EOF
chmod +x /jffs/scripts/services-start
```

**Important:** Do NOT use `service restart_dnsmasq` — it regenerates
`/etc/hosts` from firmware defaults, wiping custom entries. Use
`kill -HUP $(pidof dnsmasq)` to reload without regeneration.

**Note:** `/jffs/configs/dnsmasq.conf.add` does NOT work on this firmware
version. The `address=/game.gh-command.com/192.168.50.96` entry there is
ignored because dnsmasq's config never includes it.

### Fix Option C: Per-Device DNS (Phones)

On each phone, set DNS to Cloudflare (1.1.1.1) or Google (8.8.8.8) instead of
the router. This bypasses the router's DNS rebinding protection.

- **Android**: Settings → Network → Private DNS → `one.one.one.one`
- **iOS**: Settings → Wi-Fi → (i) → Configure DNS → Manual → Add `1.1.1.1`

Note: This only works if the phone is on the same WiFi network as the server.

### Dev PC: Windows Hosts File

The dev PC has a hosts file entry (no router DNS needed):
```
192.168.50.96 game.gh-command.com
```
Location: `C:\Windows\System32\drivers\etc\hosts`

## Certificate Setup

### Let's Encrypt (production — trusted by all browsers)

Obtained via certbot with Cloudflare DNS-01 challenge:
```
certbot certonly --dns-cloudflare \
  --dns-cloudflare-credentials ~/.secrets/cloudflare.ini \
  -d game.gh-command.com
```

Cert location: `C:\Certbot\live\game.gh-command.com\`
- `fullchain.pem` — leaf + intermediate chain
- `privkey.pem` — EC private key

The server auto-discovers this cert via `findCerts()` in `server/src/index.ts`.

### mkcert (development fallback)

Local certs in `certs/` cover `localhost`, `127.0.0.1`, `192.168.50.96`.
Used only when Certbot certs are not present. Requires mkcert CA installed
on each device.

## Cert Priority

`findCerts()` checks in order:
1. `SSL_CERT_PATH` / `SSL_KEY_PATH` env vars
2. `C:\Certbot\live\` (Let's Encrypt)
3. `certs/` (mkcert)

Let's Encrypt takes priority over mkcert. This means accessing via raw LAN IP
(`https://192.168.50.96:3000`) shows a cert mismatch warning — always use the
domain name instead.

## Verification Checklist

| Access Method | Expected |
|---|---|
| `https://localhost:3000` | Works (cert warning OK) |
| `https://game.gh-command.com:3000` (dev PC) | Works (hosts file) |
| `https://game.gh-command.com:3000` (phone on WiFi) | Works (after DNS fix) |
| `https://192.168.50.96:3000` | Cert mismatch warning — use domain instead |
