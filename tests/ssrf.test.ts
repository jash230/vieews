import { afterEach, describe, expect, it, vi } from "vitest";
import { assertPublicUrl, isPrivateAddress, readCapped, safeFetch } from "@/lib/net/safe-fetch";
import { mockFetch } from "./helpers";

const resolvesTo = (address: string) => async () => [{ address }];

afterEach(() => vi.unstubAllGlobals());

describe("isPrivateAddress", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1"])(
    "blocks %s",
    (ip) => expect(isPrivateAddress(ip)).toBe(true),
  );

  it.each(["::1", "::", "fc00::1", "fd12:3456::1", "fe80::1", "::ffff:127.0.0.1", "[::1]"])("blocks IPv6 %s", (ip) => expect(isPrivateAddress(ip)).toBe(true));

  it.each(["93.184.216.34", "172.32.0.1", "8.8.8.8", "2606:4700::1111", "::ffff:8.8.8.8"])("allows %s", (ip) => expect(isPrivateAddress(ip)).toBe(false));

  it.each(["::ffff:7f00:1", "[::ffff:7f00:1]", "::ffff:a9fe:a9fe", "::7f00:1", "::127.0.0.1", "64:ff9b::a9fe:a9fe", "2002:7f00:1::", "2001:0:4136:e378::1"])(
    "blocks IPv6 forms of private IPv4 %s",
    (ip) => expect(isPrivateAddress(ip)).toBe(true),
  );

  it.each(["::ffff:808:808", "64:ff9b::808:808", "2002:808:808::1"])("allows IPv6 forms of public IPv4 %s", (ip) => expect(isPrivateAddress(ip)).toBe(false));

  it("treats garbage as unsafe", () => expect(isPrivateAddress("not-an-ip")).toBe(true));
});

describe("assertPublicUrl", () => {
  it("needs https and no credentials", async () => {
    await expect(assertPublicUrl(new URL("http://example.com"), resolvesTo("93.184.216.34"))).rejects.toThrow(/https/);
    await expect(assertPublicUrl(new URL("https://a:b@example.com"), resolvesTo("93.184.216.34"))).rejects.toThrow(/credentials/);
  });

  it("rejects names that resolve to private addresses", async () => {
    await expect(assertPublicUrl(new URL("https://sneaky.example"), resolvesTo("10.0.0.5"))).rejects.toThrow(/Private/);
    await expect(assertPublicUrl(new URL("https://localhost"), resolvesTo("93.184.216.34"))).rejects.toThrow(/Private/);
    await expect(assertPublicUrl(new URL("https://[::1]/x"), resolvesTo("93.184.216.34"))).rejects.toThrow(/Private/);
  });

  it("rejects when any resolved address is private", async () => {
    const mixed = async () => [{ address: "93.184.216.34" }, { address: "127.0.0.1" }];
    await expect(assertPublicUrl(new URL("https://example.com"), mixed)).rejects.toThrow(/Private/);
  });
});

describe("safeFetch", () => {
  it("re-checks every redirect hop", async () => {
    mockFetch([
      [/^https:\/\/public\.example\/start/, () => new Response(null, { status: 302, headers: { location: "https://internal.example/admin" } })],
      [/internal\.example/, () => new Response("secret")],
    ]);
    const lookup = async (host: string) => [{ address: host === "internal.example" ? "10.0.0.1" : "93.184.216.34" }];
    await expect(safeFetch("https://public.example/start", {}, { lookup })).rejects.toThrow(/Private/);
  });

  it("follows public redirects", async () => {
    mockFetch([
      [/a\.example\/next$/, () => new Response("ok")],
      [/a\.example\/$/, () => new Response(null, { status: 301, headers: { location: "/next" } })],
    ]);
    const res = await safeFetch("https://a.example/", {}, { lookup: resolvesTo("93.184.216.34") });
    expect(await res.text()).toBe("ok");
  });

  it("stops after too many redirects", async () => {
    mockFetch([[/loop\.example/, () => new Response(null, { status: 302, headers: { location: "https://loop.example/again" } })]]);
    await expect(safeFetch("https://loop.example/", {}, { lookup: resolvesTo("93.184.216.34"), maxRedirects: 2 })).rejects.toThrow(/Too many/);
  });
});

describe("readCapped", () => {
  it("stops reading past the limit even without content-length", async () => {
    await expect(readCapped(new Response(new Uint8Array(2048)), 1024)).rejects.toThrow(/larger/);
    expect((await readCapped(new Response(new Uint8Array(512)), 1024)).byteLength).toBe(512);
  });
});
