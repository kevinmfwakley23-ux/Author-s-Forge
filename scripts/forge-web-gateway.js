const HOSTED_OFFICES = Object.freeze([
  Object.freeze({ id: "journal", prefix: "/journal" }),
  Object.freeze({ id: "workbooks", prefix: "/workbooks" }),
  Object.freeze({ id: "specialized", prefix: "/specialized" }),
]);

function resolveHostedRoute(requestUrl) {
  const parsed = new URL(requestUrl || "/", "http://forge.local");
  for (const office of HOSTED_OFFICES) {
    if (parsed.pathname === office.prefix) {
      return {
        serviceId: office.id,
        prefix: office.prefix,
        redirectPath: `${office.prefix}/${parsed.search}`,
        upstreamPath: null,
      };
    }
    if (parsed.pathname.startsWith(`${office.prefix}/`)) {
      const strippedPath = parsed.pathname.slice(office.prefix.length) || "/";
      return {
        serviceId: office.id,
        prefix: office.prefix,
        redirectPath: null,
        upstreamPath: `${strippedPath}${parsed.search}`,
      };
    }
  }
  return {
    serviceId: "studio",
    prefix: "",
    redirectPath: null,
    upstreamPath: `${parsed.pathname}${parsed.search}`,
  };
}

function rewriteHostedHtml(html, prefix = "") {
  let output = String(html ?? "");
  if (prefix) {
    output = output.replace(/\b(src|href)=(['"])\/(?!\/)/gi, (_match, attr, quote) => `${attr}=${quote}${prefix}/`);
  }
  const hostedAssets = [
    '<link rel="stylesheet" href="/forge-hosted-client.css">',
    '<script src="/forge-hosted-client.js"></script>',
  ].join("");
  if (output.includes("</head>")) return output.replace("</head>", `${hostedAssets}</head>`);
  return `${hostedAssets}${output}`;
}

function firstForwardedValue(value) {
  return String(value ?? "").split(",")[0].trim().toLowerCase();
}

function requestProtocol(headers = {}, fallback = "http") {
  const forwarded = firstForwardedValue(headers["x-forwarded-proto"]);
  return forwarded || fallback;
}

function isHttpsRequest(headers = {}, forceSecure = false) {
  return forceSecure || requestProtocol(headers) === "https";
}

function publicOrigin(headers = {}, fallbackHost = "localhost") {
  const protocol = requestProtocol(headers);
  const host = firstForwardedValue(headers["x-forwarded-host"]) || String(headers.host || fallbackHost).trim();
  return `${protocol}://${host}`;
}

module.exports = {
  HOSTED_OFFICES,
  isHttpsRequest,
  publicOrigin,
  requestProtocol,
  resolveHostedRoute,
  rewriteHostedHtml,
};
