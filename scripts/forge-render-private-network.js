"use strict";

function privateHostPort(value, label) {
  const text = String(value || "").trim();
  if (!text) return undefined;
  if (text.includes("://") || text.includes("/") || /\s/.test(text)) {
    throw new Error(`${label} must use Render private host:port format, not a URL.`);
  }
  const separator = text.lastIndexOf(":");
  if (separator < 1 || separator === text.length - 1) {
    throw new Error(`${label} must use Render private host:port format.`);
  }
  const host = text.slice(0, separator);
  const rawPort = text.slice(separator + 1);
  if (!/^[A-Za-z0-9.-]+$/.test(host)) throw new Error(`${label} contains an invalid private hostname.`);
  if (!/^\d{1,5}$/.test(rawPort)) throw new Error(`${label} must contain a numeric port.`);
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`${label} port must be from 1 to 65535.`);
  return `${host}:${port}`;
}

function applyRenderPrivateNetworkEnv(env = process.env) {
  if (!env.KINGS_AI_RESPONSES_URL?.trim()) {
    const hostport = privateHostPort(env.KINGS_AI_HOSTPORT, "KINGS_AI_HOSTPORT");
    if (hostport) env.KINGS_AI_RESPONSES_URL = `http://${hostport}/v1/responses`;
  }
  return env;
}

module.exports = { applyRenderPrivateNetworkEnv, privateHostPort };
