import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";

/* eslint-disable @typescript-eslint/no-explicit-any */
const ORIGIN = "https://datrix.test";
const src = readFileSync(join(process.cwd(), "public/sw.js"), "utf8");

function makeCaches() {
  const stores = new Map<string, Map<string, Response>>();
  const keyOf = (r: any) => (typeof r === "string" ? new URL(r, ORIGIN).href : r.url);
  const mk = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const m = stores.get(name)!;
    return {
      match: async (r: any) => m.get(keyOf(r))?.clone(),
      put: async (r: any, res: Response) => { m.set(keyOf(r), res); },
      delete: async (r: any) => m.delete(keyOf(r)),
      keys: async () => [...m.keys()].map((u) => new Request(u)),
      add: async () => {},
    };
  };
  return { stores, open: async (n: string) => mk(n), keys: async () => [...stores.keys()], delete: async (n: string) => stores.delete(n) };
}

function load(fetchImpl: any = async () => { throw new Error("offline"); }) {
  const caches = makeCaches();
  const self: any = { location: { origin: ORIGIN }, addEventListener() {}, clients: { claim: async () => {} } };
  const sandbox: any = { self, caches, fetch: fetchImpl, Response, Request, Headers, URL, Date };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return { sw: self.__datrixSw, caches };
}

function basic(body: string, init: ResponseInit = {}, type = "basic") {
  const r = new Response(body, init);
  Object.defineProperty(r, "type", { value: type });
  return r;
}
function req(path: string, init: any = {}) {
  const r: any = new Request(ORIGIN + path, init);
  return Object.assign(r, init.mode ? {} : {});
}
function ev(request: any) {
  const pending: Promise<any>[] = [];
  return { request, waitUntil: (p: Promise<any>) => pending.push(p), pending };
}
const navReq = (path: string) => ({ url: ORIGIN + path, method: "GET", mode: "navigate", destination: "document", headers: new Headers() });

describe("sw routing", () => {
  const { sw } = load();
  const r = (path: string, extra: any = {}) => sw.routeFor({ url: ORIGIN + path, method: "GET", headers: new Headers(), ...extra }, ORIGIN);
  it("handles app routes", () => {
    expect(r("/api/articles?categories=ai")).toBe("articles");
    expect(r("/_next/static/a.js")).toBe("static");
    expect(r("/icon-192.png")).toBe("image");
    expect(r("/category/ai", { mode: "navigate" })).toBe("navigate");
  });
  it("does not handle non-GET, cross-origin, cron/push/other api, Range", () => {
    expect(r("/api/articles", { method: "POST" })).toBeNull();
    expect(sw.routeFor({ url: "https://evil.test/x.png", method: "GET", headers: new Headers() }, ORIGIN)).toBeNull();
    expect(r("/api/cron/news")).toBeNull();
    expect(r("/api/push/subscribe")).toBeNull();
    expect(r("/api/other")).toBeNull();
    expect(r("/video.png", { headers: new Headers({ Range: "bytes=0-1" }) })).toBeNull();
  });
});

describe("sw cacheability", () => {
  const { sw } = load();
  it("rejects 206, no-store, private, non-basic, non-200, Vary *", () => {
    expect(sw.isCacheable(basic("x", { status: 206 }))).toBe(false);
    expect(sw.isCacheable(basic("x", { headers: { "Cache-Control": "no-store" } }))).toBe(false);
    expect(sw.isCacheable(basic("x", { headers: { "Cache-Control": "private, max-age=5" } }))).toBe(false);
    expect(sw.isCacheable(basic("x", {}, "cors"))).toBe(false);
    expect(sw.isCacheable(basic("x", {}, "opaque"))).toBe(false);
    expect(sw.isCacheable(basic("x", { status: 404 }))).toBe(false);
    expect(sw.isCacheable(basic("x", { headers: { Vary: "*" } }))).toBe(false);
  });
  it("accepts 200 basic", () => {
    expect(sw.isCacheable(basic("x", { headers: { "Cache-Control": "s-maxage=300" } }))).toBe(true);
  });
});

describe("sw navigation fallback", () => {
  it("offline / -> cached /", async () => {
    const { sw, caches } = load();
    await (await caches.open(sw.SHELL_CACHE)).put("/", new Response("HOME"));
    await (await caches.open(sw.SHELL_CACHE)).put("/offline.html", new Response("OFFLINE"));
    expect(await (await sw.navigationHandler(ev(navReq("/")))).text()).toBe("HOME");
  });
  it("offline /category/ai -> /offline.html, never Home", async () => {
    const { sw, caches } = load();
    await (await caches.open(sw.SHELL_CACHE)).put("/", new Response("HOME"));
    await (await caches.open(sw.SHELL_CACHE)).put("/offline.html", new Response("OFFLINE"));
    expect(await (await sw.navigationHandler(ev(navReq("/category/ai")))).text()).toBe("OFFLINE");
  });
  it("exact cached hit wins", async () => {
    const { sw, caches } = load();
    await (await caches.open(sw.SHELL_CACHE)).put("/category/ai", new Response("AI"));
    await (await caches.open(sw.SHELL_CACHE)).put("/offline.html", new Response("OFFLINE"));
    expect(await (await sw.navigationHandler(ev(navReq("/category/ai")))).text()).toBe("AI");
  });
});

describe("sw legacy caches", () => {
  const { sw } = load();
  it("detects next-pwa/workbox caches only", () => {
    for (const n of ["workbox-precache-v2-x", "start-url", "pages", "next-image", "apis", "next-data"]) expect(sw.isLegacyCacheName(n)).toBe(true);
    for (const n of ["datrix-static-v2", "datrix-articles", "my-other-app", "pages-custom"]) expect(sw.isLegacyCacheName(n)).toBe(false);
  });
});

describe("sw SWR resilience", () => {
  it("returns network response even if cache.put throws", async () => {
    const { sw, caches } = load(async () => basic('{"ok":1}', { headers: { "Cache-Control": "s-maxage=300" } }));
    const orig = caches.open;
    caches.open = async (n: string) => ({ ...(await orig(n)), put: async () => { throw new Error("quota"); } }) as any;
    const e = ev(req("/api/articles?x=1"));
    const res = await sw.staleWhileRevalidateArticles(e);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('{"ok":1}');
  });
});

describe("sw push", () => {
  const { sw } = load();
  it("parsePushData handles valid, invalid, empty and oversize", () => {
    expect(sw.parsePushData(JSON.stringify({ title: "T", body: "B", url: "/" }))).toEqual({ title: "T", body: "B", url: "/" });
    const generic = { title: "Datrix", body: "Fresh stories are ready.", url: "/" };
    expect(sw.parsePushData("not json")).toEqual(generic);
    expect(sw.parsePushData("")).toEqual(generic);
    expect(sw.parsePushData("null")).toEqual(generic);
    expect(sw.parsePushData("[1]")).toEqual(generic);
    expect(sw.parsePushData(JSON.stringify({ title: 5, body: "  " }))).toEqual(generic);
    const big = sw.parsePushData(JSON.stringify({ title: "a".repeat(200), body: "b".repeat(500) }));
    expect(big.title.length).toBe(80);
    expect(big.body.length).toBe(240);
  });
  it("safeNotificationUrl only allows same-origin relative paths", () => {
    expect(sw.safeNotificationUrl("/category/ai")).toBe("/category/ai");
    expect(sw.safeNotificationUrl("/category/ai?x=1")).toBe("/category/ai?x=1");
    for (const bad of ["/\t/evil.com", "/\n/evil.com", "/\r/evil.com", "//evil.com", "https://evil.com", "javascript:alert(1)", "data:text/html,x", "/\\evil.com", "/" + "a".repeat(600), "", undefined, 5]) {
      expect(sw.safeNotificationUrl(bad)).toBe("/");
    }
  });
  it("registers push and notificationclick handlers that use waitUntil", async () => {
    const handlers: Record<string, any> = {};
    const shown: any[] = [];
    const focused: string[] = [];
    const opened: string[] = [];
    const self: any = {
      location: { origin: ORIGIN },
      addEventListener: (t: string, fn: any) => { handlers[t] = fn; },
      registration: { showNotification: async (t: string, o: any) => { shown.push([t, o]); } },
      clients: {
        matchAll: async () => [{ url: ORIGIN + "/x", focus: async () => { focused.push("x"); }, navigate: async (u: string) => ({ focus: async () => { focused.push(u); } }) }],
        openWindow: async (u: string) => { opened.push(u); },
        claim: async () => {},
      },
    };
    const sandbox: any = { self, caches: makeCaches(), fetch: async () => {}, Response, Request, Headers, URL, Date };
    vm.createContext(sandbox);
    vm.runInContext(src, sandbox);
    const e1 = ev(null) as any;
    e1.data = { text: () => '{"title":"Hi","body":"There","url":"/"}' };
    handlers.push(e1);
    await Promise.all(e1.pending);
    expect(shown[0][0]).toBe("Hi");
    expect(shown[0][1]).toMatchObject({ body: "There", tag: "datrix-daily", icon: "/icon-192.png", data: { url: "/" } });
    let closed = false;
    const e2 = ev(null) as any;
    e2.notification = { close: () => { closed = true; }, data: { url: "//evil.com" } };
    handlers.notificationclick(e2);
    await Promise.all(e2.pending);
    expect(closed).toBe(true);
    expect(focused).toEqual([ORIGIN + "/"]);
    expect(opened).toEqual([]);
  });
});

describe("sw notification click", () => {
  function setup(clients: any[]) {
    const opened: string[] = [];
    const self: any = {
      location: { origin: ORIGIN },
      addEventListener() {},
      clients: { matchAll: async () => clients, openWindow: async (u: string) => { opened.push(u); }, claim: async () => {} },
    };
    const sandbox: any = { self, caches: makeCaches(), fetch: async () => {}, Response, Request, Headers, URL, Date };
    vm.createContext(sandbox);
    vm.runInContext(src, sandbox);
    return { sw: self.__datrixSw, opened };
  }
  it("opens a window when no client exists", async () => {
    const { sw, opened } = setup([]);
    await sw.handleNotificationClick("/category/ai");
    expect(opened).toEqual([ORIGIN + "/category/ai"]);
  });
  it("opens '/' for a smuggled cross-origin url", async () => {
    const { sw, opened } = setup([]);
    await sw.handleNotificationClick("/\t/evil.com");
    expect(opened).toEqual([ORIGIN + "/"]);
  });
  it("focuses and does not open a duplicate when navigate rejects", async () => {
    let focused = 0;
    const { sw, opened } = setup([{ url: ORIGIN + "/x", navigate: async () => { throw new Error("no"); }, focus: async () => { focused++; } }]);
    await sw.handleNotificationClick("/");
    expect(focused).toBe(1);
    expect(opened).toEqual([]);
  });
});
