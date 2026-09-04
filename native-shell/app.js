(() => {
  "use strict";

  const STORAGE_KEY = "authors-forge-native-url";
  const form = document.getElementById("connect-form");
  const input = document.getElementById("forge-url");
  const status = document.getElementById("status");

  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) input.value = saved;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    status.className = "status";
    status.textContent = "Checking the real Forge gateway…";

    let target;
    try {
      target = validateForgeUrl(input.value);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
      return;
    }

    const healthUrl = new URL("/healthz", target.origin);
    try {
      const response = await fetch(healthUrl, { method: "GET", cache: "no-store", credentials: "omit" });
      if (!response.ok) throw new Error(`gateway returned HTTP ${response.status}`);
      const payload = await response.json().catch(() => null);
      if (!payload || payload.ok !== true) throw new Error("gateway health response was not valid");
    } catch (error) {
      setError(`Forge is not reachable at ${target.origin}. ${error instanceof Error ? error.message : String(error)}`);
      return;
    }

    localStorage.setItem(STORAGE_KEY, target.origin);
    status.textContent = "Forge verified. Opening the workplace…";
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
