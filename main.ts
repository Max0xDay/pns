import { PNSConfig } from "./config/config.ts";
import { DNSCache } from "./cache/cache.ts";
import { QueryLogger } from "./logger/logger.ts";
import { DNSServer } from "./dns/server.ts";
import { createWebServer } from "./web/server.ts";

async function main() {
  const config = new PNSConfig();
  const configData = await config.load();
  
  const cache = new DNSCache(configData.cache.maxEntries, configData.cache.ttl);
  const logger = new QueryLogger(configData.logging.maxEntries);
  const startTime = Date.now();

  const dnsServer = new DNSServer(config, cache, logger);
  
  const webApp = createWebServer({ config, logger, cache, startTime });

  webApp.use(async (ctx, next) => {
    if (ctx.request.url.pathname === "/ws") {
      if (ctx.isUpgradable) {
        const ws = ctx.upgrade();
        dnsServer.addWebSocketConnection(ws);
        
        ws.onclose = () => {
          dnsServer.removeWebSocketConnection(ws);
        };
      }
    }
    await next();
  });

  try {
    dnsServer.start(configData.dnsPort);
    
    const _webListener = webApp.listen({ port: configData.webPort });

    const shutdown = () => {
      dnsServer.stop();
      Deno.exit(0);
    };

    Deno.addSignalListener("SIGINT", shutdown);
    Deno.addSignalListener("SIGTERM", shutdown);

    await new Promise<void>(() => {});

  } catch (err) {
    if (err instanceof Deno.errors.PermissionDenied) {
      Deno.stderr.writeSync(new TextEncoder().encode(`Error: Permission denied to bind to port ${configData.dnsPort}.\n`));
      Deno.stderr.writeSync(new TextEncoder().encode("Try one of these solutions:\n"));
      Deno.stderr.writeSync(new TextEncoder().encode("  1. Run with sudo: sudo deno run --allow-net --allow-read --allow-write main.ts\n"));
      Deno.stderr.writeSync(new TextEncoder().encode("  2. Change DNS port in config to something above 1024\n"));
    } else {
      Deno.stderr.writeSync(new TextEncoder().encode(`Error starting server: ${err}\n`));
    }
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}
