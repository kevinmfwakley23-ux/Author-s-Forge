const { randomBytes, timingSafeEqual } = require("node:crypto");

const ACCESS_COOKIE = "forge_access";

function normalizeHost(host) {
  return String(host ?? "").trim().toLowerCase().replace(/^\[/, "").replace(/\]$/, "");
}

function isLoopbackHost(host) {
  const value = normalizeHost(host);
  return value === "127.0.0.1" || value === "localhost" || value === "::1";
}

function createAccessToken() {
  return randomBytes(32).toString("base64url");
}

function safeTokenEqual(left, right) {
  if (typeof left !== "string" || typeof right !== "string" || !left || !right) return false;
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function parseCookies(header) {
  const cookies = Object.create(null);
  for (const part of String(header ?? "").split(";")) {
    const index = part.indexOf("=");
    if (index < 1) continue;
    const key = part.slice(0, index).trim();
    const rawValue = part.slice(index + 1).trim();
    if (!key) continue;
    try { cookies[key] = decodeURIComponent(rawValue); }
    catch { cookies[key] = rawValue; }
  }
  return cookies;
}

function accessCookie(token) {
  return `${ACCESS_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict`;
}

function authorizeLanRequest({ requestUrl, cookieHeader, token }) {
  const parsed = new URL(requestUrl || "/", "http://forge.local");
  const bootstrapToken = parsed.searchParams.get("access");
  if (bootstrapToken && safeTokenEqual(bootstrapToken, token)) {
    parsed.searchParams.delete("access");
    const search = parsed.searchParams.toString();
    return {
      authorized: true,
      bootstrap: true,
      redirectPath: `${parsed.pathname}${search ? `?${search}` : ""}${parsed.hash}`,
      setCookie: accessCookie(token),
    };
  }
  const cookies = parseCookies(cookieHeader);
  return {
    authorized: safeTokenEqual(cookies[ACCESS_COOKIE], token),
    bootstrap: false,
    redirectPath: null,
    setCookie: null,
  };
}

function securityHeaders() {
  return {
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "no-referrer",
    "cross-origin-resource-policy": "same-origin",
    "permissions-policy": "camera=(), geolocation=(), payment=(), usb=()",
  };
}

module.exports = {
  ACCESS_COOKIE,
  accessCookie,
  authorizeLanRequest,
  createAccessToken,
  isLoopbackHost,
  parseCookies,
  safeTokenEqual,
  securityHeaders,
};
