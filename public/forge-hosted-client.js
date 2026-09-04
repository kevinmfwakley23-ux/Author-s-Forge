(() => {
  "use strict";

  const OFFICE_PREFIXES = ["/journal", "/workbooks", "/specialized"];
  const PORT_PATHS = Object.freeze({
    "4173": "/",
    "4273": "/journal/",
    "4373": "/workbooks/",
    "4473": "/specialized/",
  });

  const pathname = location.pathname || "/";
  const officePrefix = OFFICE_PREFIXES.find((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)) || "";
  const isPlayStation5 = /PlayStation 5/i.test(navigator.userAgent || "");

  document.documentElement.classList.add("forge-hosted");
  if (officePrefix) document.documentElement.dataset.forgeOfficePrefix = officePrefix;
  if (isPlayStation5) document.documentElement.classList.add("forge-console", "forge-ps5");

  function prefixApiPath(value) {
    if (!officePrefix || typeof value !== "string" || !value.startsWith("/api/")) return value;
    return `${officePrefix}${value}`;
  }

  const nativeFetch = window.fetch?.bind(window);
  if (nativeFetch) {
    window.fetch = function forgeHostedFetch(input, init) {
      if (typeof input === "string") return nativeFetch(prefixApiPath(input), init);
      if (input instanceof URL && input.origin === location.origin && input.pathname.startsWith("/api/")) {
        const rewritten = new URL(input.href);
        rewritten.pathname = `${officePrefix}${rewritten.pathname}`;
        return nativeFetch(rewritten, init);
      }
      if (typeof Request !== "undefined" && input instanceof Request) {
        const url = new URL(input.url, location.href);
        if (officePrefix && url.origin === location.origin && url.pathname.startsWith("/api/")) {
          url.pathname = `${officePrefix}${url.pathname}`;
          return nativeFetch(new Request(url.href, input), init);
        }
      }
      return nativeFetch(input, init);
    };
  }

  if (window.XMLHttpRequest?.prototype?.open) {
    const nativeOpen = window.XMLHttpRequest.prototype.open;
    window.XMLHttpRequest.prototype.open = function forgeHostedXhrOpen(method, url, ...rest) {
      return nativeOpen.call(this, method, prefixApiPath(url), ...rest);
    };
  }

  function remapForgeUrl(raw) {
    if (!raw || typeof raw !== "string") return raw;
    let url;
    try { url = new URL(raw, location.href); }
    catch { return raw; }
    if (url.hostname !== location.hostname) return raw;
    const mappedPath = PORT_PATHS[url.port];
    if (!mappedPath) return raw;
    const originalPath = url.pathname || "/";
    const targetPath = mappedPath === "/" ? originalPath : `${mappedPath.replace(/\/$/, "")}${originalPath === "/" ? "/" : originalPath}`;
    url.protocol = location.protocol;
    url.host = location.host;
    url.pathname = targetPath.replace(/\/+/g, "/");
    return url.href;
  }

  function rewriteAnchors(root = document) {
    root.querySelectorAll?.("a[href]").forEach((anchor) => {
      const mapped = remapForgeUrl(anchor.href);
      if (mapped && mapped !== anchor.href) anchor.href = mapped;
    });
  }

  const nativeOpen = window.open?.bind(window);
  if (nativeOpen) {
    window.open = function forgeHostedWindowOpen(url, ...rest) {
      return nativeOpen(remapForgeUrl(String(url || "")), ...rest);
    };
  }

  function installConsoleNotice() {
    if (!isPlayStation5 || document.getElementById("forge-console-notice")) return;
    const notice = document.createElement("div");
    notice.id = "forge-console-notice";
    notice.setAttribute("role", "status");
    notice.textContent = "Author's Forge console browser mode";
    document.body.appendChild(notice);
  }

  function ready() {
    rewriteAnchors();
    installConsoleNotice();
    if (typeof MutationObserver !== "undefined") {
      const observer = new MutationObserver((records) => {
        for (const record of records) {
          if (record.type === "attributes" && record.target instanceof HTMLAnchorElement) rewriteAnchors(record.target.parentNode || document);
          for (const node of record.addedNodes || []) if (node.nodeType === 1) rewriteAnchors(node);
        }
      });
      observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["href"] });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready, { once: true });
  else ready();
})();
