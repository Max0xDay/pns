#!/bin/bash

echo "Starting PNS - Perfect Name Server"
echo "=================================="

if ! command -v deno &> /dev/null; then
    echo "Deno is not installed!"
    echo "Please install Deno first:"
    echo "curl -fsSL https://deno.land/install.sh | sh"
    exit 1
fi

echo "Deno found: $(deno --version | head -n1)"

if [[ $EUID -ne 0 ]] && [[ ! -f "pns-config.json" ]]; then
    echo "Warning: Not running as root. DNS port 53 may not be accessible."
    echo "You can either:"
    echo "1. Run with sudo: sudo ./start.sh"
    echo "2. Use a different port (will be configured automatically)"
    echo ""
fi

if [[ ! -f "pns-config.json" ]]; then
    echo "Creating initial configuration..."
    
    if [[ $EUID -ne 0 ]]; then
        cat > pns-config.json << EOF
{
  "dnsPort": 5353,
  "webPort": 8080,
  "forwarders": ["8.8.8.8", "8.8.4.4", "1.1.1.1"],
  "cache": {
    "enabled": true,
    "ttl": 300,
    "maxEntries": 10000
  },
  "blocklist": {
    "enabled": true,
    "domains": ["example-blocked-domain.com"]
  },
  "customRecords": [
    {
      "name": "local.pns",
      "type": "A",
      "ttl": 300,
      "address": "192.168.1.100"
    }
  ],
  "logging": {
    "enabled": true,
    "maxEntries": 1000
  }
}
EOF
        echo "Configuration created with DNS port 5353 (non-privileged)"
    fi
fi

echo ""
echo "Starting PNS server..."
echo ""

deno run --allow-net --allow-read --allow-write main.ts
