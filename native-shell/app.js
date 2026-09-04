(() => {
  "use strict";

  const STORAGE_KEY = "authors-forge-native-url";
  const form = document.getElementById("connect-form");
  const input = document.getElementById("forge-url");
  const status = document.getElementById("status");

  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) input.value = saved;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    status.className = "status";

    let target;
    try {
      target = validateForgeUrl(input.value);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
      return;
    }

    // A normal browser fetch from the Tauri asset origin to a remote Forge
    // gateway can be blocked by WebView CORS before the request ever proves
    // whether Forge is healthy. Navigation itself is the truthful transport:
    // the real gateway owns authentication, login/bootstrap, HTTP errors, and
    // project availability. Do not turn a CORS policy mismatch into a fake
    // "server offline" status.
    localStorage.setItem(STORAGE_KEY, target.origin);
    status.textContent = "Opening the real Forge gateway…";
    window.location.assign(target.href);
  });

  function validateForgeUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) throw new Error("Enter the address of your Forge runtime.");
    let parsed;
    try { parsed = new URL(raw); }
    catch { throw new Error("Enter a valid Forge URL."); }

    const localHost = parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost" || parsed.hostname === "::1";
    if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && localHost)) {
      throw new Error("Remote Forge connections must use HTTPS. Plain HTTP is allowed only for localhost development.");
    }
    if (parsed.username || parsed.password) throw new Error("Do not put usernames or passwords in the Forge URL.");
    return parsed;
  }

  function setError(message) {
    status.className = "status error";
    status.textContent = message;
  }
})();
