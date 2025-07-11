# PNS - Perfect Name Server

A test concept of a deno written DNS Server built for understanding purposes.

## Features

- **Full DNS Protocol Support**: Handles UDP and TCP DNS queries
- **Intelligent Caching**: Configurable DNS response caching with TTL support
- **Domain Blocking**: Built-in blocklist for unwanted domains
- **Custom Records**: Define your own DNS records
- **Real-time Web Interface**: Modern web UI with live query monitoring
- **Statistics & Monitoring**: Detailed query statistics and performance metrics
- **Query Logging**: Complete logging of all DNS queries with filters
- **WebSocket Updates**: Real-time updates in the web interface
- **Configurable Forwarders**: Use any upstream DNS servers

## Project Structure

```
pns/
├── main.ts                 # Entry point
├── deno.json              # Deno configuration
├── config/
│   └── config.ts          # Configuration management
├── dns/
│   ├── constants.ts       # DNS protocol constants
│   ├── packet.ts          # DNS packet parser/builder
│   ├── resolver.ts        # DNS resolver
│   └── server.ts          # DNS server implementation
├── cache/
│   └── cache.ts           # DNS cache implementation
├── logger/
│   └── logger.ts          # Query logger
└── web/
    ├── server.ts          # Web server and API
    └── static.ts          # Static HTML/JS/CSS
```

## Installation & Setup

1. **Install Deno** (if not already installed):
   ```bash
   curl -fsSL https://deno.land/install.sh | sh
   ```

2. **Clone or download the project files**

3. **Run the DNS server**:
   ```bash
   # Standard run
   deno run --allow-net --allow-read --allow-write main.ts
   
   # Development mode with auto-reload
   deno task dev
   
   # Using the configured task
   deno task start
   ```

## Usage

### Starting the Server

```bash
# Run with default settings
deno run --allow-net --allow-read --allow-write main.ts

# For development with file watching
deno task dev
```

### Default Configuration

- **DNS Port**: 53 (requires root/sudo for ports < 1024)
- **Web Interface**: http://localhost:8080
- **Forwarders**: 8.8.8.8, 8.8.4.4, 1.1.1.1

### Using as System DNS

To use PNS as your system DNS server:

**Linux**:
   ```bash
   # Edit /etc/resolv.conf
   sudo nano /etc/resolv.conf
   
   # Add at the top:
   nameserver 127.0.0.1
   ```

## Configuration

The server creates a `pns-config.json` file with the following structure:

```json
{
  "dnsPort": 53,
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
```

## Web Interface

Access the web interface at `http://localhost:8080` (or your configured port).

### Features:

- **Dashboard**: Real-time statistics and server status
- **Query Log**: Live view of all DNS queries
- **Configuration**: Edit all settings through the web interface
- **Cache Management**: View and clear DNS cache
- **Statistics**: Detailed performance metrics

## API Endpoints

- `GET /api/config` - Get current configuration
- `PUT /api/config` - Update configuration
- `GET /api/stats` - Get server statistics
- `GET /api/queries` - Get query log
- `POST /api/cache/clear` - Clear DNS cache
- `POST /api/logs/clear` - Clear query logs
- `GET /ws` - WebSocket for real-time updates

## DNS Features

### Supported Record Types

- **A Records**: IPv4 addresses
- **AAAA Records**: IPv6 addresses
- **CNAME Records**: Canonical names
- **MX Records**: Mail exchange
- **TXT Records**: Text records
- **NS Records**: Name servers
- **PTR Records**: Reverse DNS

## License

This project is open source and available under the MIT License.
---


