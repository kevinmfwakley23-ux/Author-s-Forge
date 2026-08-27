const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers || {}) },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

function toast(message) {
  const el = $("#toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("show");
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => el.classList.remove("show"), 2400);
}

function pct(value) {
  return `${Math.max(0, Math.min(100, Number(value) || 0))}%`;
}

function activateSection(id, updateHistory = true) {
  const target = document.getElementById(id);
  if (!target) return false;
  $$(".section").forEach((section) => section.classList.toggle("active", section.id === id));
  $$('nav button[data-section]').forEach((button) => button.classList.toggle("active", button.dataset.section === id));
  if (updateHistory) history.replaceState(null, "", `#${id}`);
  window.scrollTo({ top: 0, behavior: "smooth" });
  return true;
}

function bindNavigation() {
  const nav = $("nav");
  if (!nav) return;
  nav.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-section]");
    if (!button || !nav.contains(button)) return;
    event.preventDefault();
    activateSection(button.dataset.section);
  });

  $$("[data-open-section]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      activateSection(button.dataset.openSection);
    });
  });

  const hash = location.hash.slice(1);
  if (hash && document.getElementById(hash)) activateSection(hash, false);
}

function render(state) {
  $("#title").textContent = state.project.title;
  $("#project-id").textContent = state.project.id;
  $("#mode").value = state.collaborationMode;

  const health = state.health;
  const cards = [
    ["Book completion", health ? pct(health.bookCompletionPercent) : "0%"],
    ["Chapters", health ? `${health.chaptersComplete} / ${health.chaptersTotal}` : "0 / 0"],
    ["Word count", health ? `${health.wordCount.toLocaleString()} / ${health.wordTarget.toLocaleString()}` : "0 / 0"],
    ["Canon conflicts", health ? `${health.canonConflicts.critical} critical · ${health.canonConflicts.minor} minor` : "0"],
    ["Characters", health?.characters ?? 0],
    ["Locations", health?.locations ?? 0],
    ["Research sources", health?.researchSources ?? 0],
    ["Illustrations", health?.illustrations ?? 0],
    ["Publishing readiness", health ? pct(health.publishingReadinessPercent) : "0%"],
  ];
  $("#metrics").innerHTML = cards.map(([label, value]) => `<div class="metric"><span>${label}</span><strong>${value}</strong></div>`).join("");

  const finalProduct = state.finalProduct || { completed: [], ready: false, message: "" };
  $("#pipeline").innerHTML = state.stages.map((stage, index) => `
    <button type="button" class="pipe ${finalProduct.completed.includes(stage) ? "done" : ""}" data-open-section="publishing" data-stage="${stage}">
      <span>${String(index + 1).padStart(2, "0")}</span><b>${stage}</b><em>${finalProduct.completed.includes(stage) ? "Complete" : "Open →"}</em>
    </button>`).join("");

  $("#stages").innerHTML = state.stages.map((stage) => `
    <button type="button" class="stage ${finalProduct.completed.includes(stage) ? "complete" : ""}" data-stage="${stage}">${stage}</button>`).join("");

  $("#ready").textContent = finalProduct.ready ? finalProduct.message : "PROJECT NOT READY — required production stages remain.";
  $("#ready").className = `ready ${finalProduct.ready ? "approved" : ""}`;
  $("#memory-list").innerHTML = (state.relationshipMemories || []).map((memory) => `<div class="memory"><b>${memory.subject}</b> <span>${memory.predicate}</span> <b>${memory.object}</b><small>${memory.context}</small></div>`).join("");
  renderGenome(state);

  $$(".stage").forEach((button) => {
    button.onclick = async () => {
      try {
        await api("/api/final-stage", { method: "POST", body: JSON.stringify({ stage: button.dataset.stage }) });
        render(await api("/api/state"));
        toast(`${button.dataset.stage} recorded`);
      } catch (error) { toast(error.message); }
    };
  });

  $$("[data-open-section]").forEach((button) => {
    button.onclick = (event) => {
      event.preventDefault();
      activateSection(button.dataset.openSection);
      if (button.dataset.stage) toast(`${button.dataset.stage}: publishing controls`);
    };
  });
}

function renderGenome(state) {
  const nodes = state.genome?.nodes || [];
  $("#genome-nodes").innerHTML = nodes.length
    ? nodes.map((node) => `<div class="node"><b>${node.label}</b><span>${node.type}</span></div>`).join("")
    : "No genome loaded.";
  $("#genome-node").innerHTML = '<option value="">Select node</option>' + nodes.map((node) => `<option value="${node.id}">${node.label} · ${node.type}</option>`).join("");
}

async function load() {
  try { render(await api("/api/state")); }
  catch (error) { toast(error.message); }
}

function bindControls() {
  $("#mode").onchange = async (event) => {
    try {
      const data = await api("/api/collaboration", { method: "POST", body: JSON.stringify({ mode: event.target.value }) });
      $("#mode-policy").textContent = `${data.policy.aiWorkShare} AI work share · author approval required`;
      toast("Collaboration mode updated");
    } catch (error) { toast(error.message); }
  };

  $("#new-project").onclick = async () => {
    const title = prompt("Project title", "My Book");
    if (!title) return;
    const id = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "forge-project";
    try { render(await api("/api/project", { method: "POST", body: JSON.stringify({ id, title }) })); toast("New project created and persisted"); }
    catch (error) { toast(error.message); }
  };

  $("#save-state").onclick = async () => {
    try { render(await api("/api/state")); toast("Project state loaded from the local Forge store"); }
    catch (error) { toast(error.message); }
  };

  $("#memory-form").onsubmit = async (event) => {
    event.preventDefault();
    try {
      const form = new FormData(event.target);
      await api("/api/relationship-memory", { method: "POST", body: JSON.stringify(Object.fromEntries(form)) });
      event.target.reset();
      render(await api("/api/state"));
      activateSection("world");
      toast("Relationship memory stored");
    } catch (error) { toast(error.message); }
  };

  $("#load-genome").onclick = async () => {
    try {
      const nodes = [
        { id: "canon-1", type: "canon", label: "Opening setting", data: { source: "author" } },
        { id: "scene-14", type: "scenes", label: "Chapter 14 snowstorm", data: {} },
        { id: "art-14", type: "art", label: "Chapter 14 illustration", data: {} },
        { id: "book-2", type: "publishing-state", label: "Book 2 continuity", data: {} },
      ];
      const edges = [
        { from: "canon-1", to: "scene-14", relation: "affects" },
        { from: "scene-14", to: "art-14", relation: "depicts" },
        { from: "canon-1", to: "book-2", relation: "constrains" },
      ];
      await api("/api/genome", { method: "POST", body: JSON.stringify({ nodes, edges }) });
      render(await api("/api/state"));
      activateSection("genome");
      toast("Book Genome loaded");
    } catch (error) { toast(error.message); }
  };

  $("#genome-node").onchange = async (event) => {
    if (!event.target.value) { $("#impact").textContent = "No impact analysis yet."; return; }
    try {
      const impact = await api(`/api/genome/impact?node=${encodeURIComponent(event.target.value)}`);
      $("#impact").textContent = JSON.stringify(impact, null, 2);
    } catch (error) { toast(error.message); }
  };
}

document.addEventListener("DOMContentLoaded", () => {
  bindNavigation();
  bindControls();
  load();
});
