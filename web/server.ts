import { Application, Router } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { PNSConfig } from "../config/config.ts";
import { QueryLogger } from "../logger/logger.ts";
import { DNSCache } from "../cache/cache.ts";

interface ServerDependencies {
  config: PNSConfig;
  logger: QueryLogger;
  cache: DNSCache;
  startTime: number;
}

export function createWebServer(deps: ServerDependencies) {
  const app = new Application();
  const router = new Router();

  router.get("/api/config", (ctx) => {
    ctx.response.body = deps.config.config;
  });

  router.put("/api/config", async (ctx) => {
    const body = await ctx.request.body().value;
    deps.config.update(body);
    ctx.response.body = { success: true };
  });

  router.get("/api/stats", (ctx) => {
    const systemInfo = Deno.systemMemoryInfo?.();
   
    //worst estimate ever
    let cpuUsage = 0;
    try {
      const loadavg = Deno.loadavg?.();
      if (loadavg && loadavg.length > 0) {
        cpuUsage = Math.min(Math.round(loadavg[0] * 100), 100);
      }
    } catch {
      cpuUsage = 0;
    }
    
    ctx.response.body = {
      uptime: Date.now() - deps.startTime,
      queries: deps.logger.getStats(),
      cache: deps.cache.stats(),
      system: {
        hostname: Deno.hostname(),
        platform: Deno.build.os,
        cpu: {
          usage: cpuUsage
        },
        memory: {
          total: systemInfo?.total || 0,
          free: systemInfo?.free || 0
        }
      }
    };
  });

  router.get("/api/queries", (ctx) => {
    const limit = parseInt(ctx.request.url.searchParams.get("limit") || "100");
    ctx.response.body = deps.logger.getQueries(limit);
  });

  router.post("/api/cache/clear", (ctx) => {
    deps.cache.clear();
    ctx.response.body = { success: true };
  });

  router.post("/api/logs/clear", (ctx) => {
    deps.logger.clear();
    ctx.response.body = { success: true };
  });

  router.get("/api/dns/:domain", (ctx) => {
    const domain = ctx.params.domain;
    if (!domain) {
      ctx.response.body = { error: "Domain required" };
      return;
    }

    try {
      const queryInfo = {
        name: domain,
        type: "A",
        client: "web-interface",
        blocked: false,
        cached: false,
        forwarded: true,
        timestamp: new Date().toISOString()
      };

      deps.logger.log(queryInfo);

      ctx.response.body = {
        domain,
        type: "A",
        address: "192.168.1.100",
        ttl: 300,
        source: "test-query"
      };
    } catch (error) {
      ctx.response.body = { error: String(error) };
    }
  });

  router.get("/", async (ctx) => {
    const html = await Deno.readTextFile(new URL("./index.html", import.meta.url));
    ctx.response.body = html;
    ctx.response.type = "text/html";
  });

  app.use(router.routes());
  app.use(router.allowedMethods());

  return app;
}
