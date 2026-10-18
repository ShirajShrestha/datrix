import { describe, it, expect } from "vitest";
import {
  urlBase64ToUint8Array, detectPushSupport, buildSubscribeBody, createEpochGuard, syncSignature, statusFromResponse, testResultFromResponse, currentTimeZone,
} from "../pushClient";

const ok = { hasServiceWorker: true, hasPushManager: true, hasNotification: true, isIOS: false, isStandalone: false };

describe("urlBase64ToUint8Array", () => {
  it("decodes url-safe base64 without padding", () => {
    expect([...urlBase64ToUint8Array("AQID")]).toEqual([1, 2, 3]);
    expect([...urlBase64ToUint8Array("-_8")]).toEqual([251, 255]);
    expect([...urlBase64ToUint8Array("-_8=")]).toEqual([251, 255]);
  });
});

describe("detectPushSupport", () => {
  it("ok on capable browsers", () => expect(detectPushSupport(ok)).toBe("ok"));
  it("unsupported when APIs are missing", () => {
    expect(detectPushSupport({ ...ok, hasPushManager: false })).toBe("unsupported");
    expect(detectPushSupport({ ...ok, hasServiceWorker: false })).toBe("unsupported");
    expect(detectPushSupport({ ...ok, hasNotification: false })).toBe("unsupported");
  });
  it("iOS outside the installed app needs install, inside is ok", () => {
    expect(detectPushSupport({ ...ok, isIOS: true, hasPushManager: false })).toBe("needs-install");
    expect(detectPushSupport({ ...ok, isIOS: true })).toBe("needs-install");
    expect(detectPushSupport({ ...ok, isIOS: true, isStandalone: true })).toBe("ok");
  });
});

describe("buildSubscribeBody", () => {
  const prefs = { categories: ["ai"], notifyTime: "08:00" };
  it("builds the body", () => {
    expect(buildSubscribeBody({ endpoint: "https://x/y", keys: { p256dh: "a", auth: "b" } }, prefs, "UTC")).toEqual({
      subscription: { endpoint: "https://x/y", keys: { p256dh: "a", auth: "b" } }, categories: ["ai"], time: "08:00", timeZone: "UTC",
    });
  });
  it("returns null without keys", () => {
    expect(buildSubscribeBody({ endpoint: "https://x/y" }, prefs, "UTC")).toBeNull();
    expect(buildSubscribeBody({ endpoint: "https://x/y", keys: { p256dh: "a" } }, prefs, "UTC")).toBeNull();
  });
});

describe("status mapping", () => {
  it("maps subscribe statuses", () => {
    expect(statusFromResponse(200)).toBe("ok");
    expect(statusFromResponse(503)).toBe("limit");
    expect(statusFromResponse(400)).toBe("error");
    expect(statusFromResponse(500)).toBe("error");
  });
  it("maps test statuses", () => {
    expect(testResultFromResponse(200)).toBe("sent");
    expect(testResultFromResponse(429)).toBe("cooldown");
    expect(testResultFromResponse(404)).toBe("gone");
    expect(testResultFromResponse(410)).toBe("gone");
    expect(testResultFromResponse(502)).toBe("error");
  });
  it("time zone is a non-empty string", () => expect(currentTimeZone().length).toBeGreaterThan(0));
});

describe("epoch guard", () => {
  it("invalidates older tokens after bump", () => {
    const g = createEpochGuard();
    const t = g.token();
    expect(g.isCurrent(t)).toBe(true);
    g.bump();
    expect(g.isCurrent(t)).toBe(false);
    expect(g.isCurrent(g.token())).toBe(true);
  });
  it("syncSignature reflects categories and time", () => {
    expect(syncSignature({ categories: ["ai"], notifyTime: "08:00" })).toBe("ai|08:00");
    expect(syncSignature({ categories: ["ai"], notifyTime: "09:00" })).not.toBe("ai|08:00");
  });
});
