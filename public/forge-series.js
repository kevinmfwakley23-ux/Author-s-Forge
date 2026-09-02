/* Author's Forge Series Engine UI. Every mutation writes through the durable project Series API. */
(() => {
  "use strict";

  const projectId = new URLSearchParams(location.search).get("project") || localStorage.getItem("forge-project") || "forge-studio";
  localStorage.setItem("forge-project", projectId);
  const selectionKey = `forge-series:${projectId}`;
  let snapshot = { series: [], options: { books: [], characters: [], visualIdentities: [] } };
  let project = null;

  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[character]));
  const api = async (path, options = {}) => {
    const response = await fetch(path, { ...options, headers: { "content-type": "application/json", ...(options.headers || {}) } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`);
    return payload;
  };

  function notify(message, ok = false) {
    const error = $("#series-error");
    const success = $("#series-success");
    if (error) error.hidden = true;
    if (success) success.hidden = true;
    const target = ok ? success : error;
    if (target) { target.textContent = message; target.hidden = false; }
  }

  function lines(value, label) {
    const values = String(value || "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
    if (new Set(values).size !== values.length) throw new Error(`${label} contains duplicate lines.`);
    return values;
  }

  function selectedValues(select) {
    return [...select.selectedOptions].map((option) => option.value).filter(Boolean);
  }

  function activeSeries() {
    const wanted = $("#series-select")?.value || localStorage.getItem(selectionKey) || "";
    return snapshot.series.find((series) => series.id === wanted) || snapshot.series[0] || null;
  }

  function bookById(id) { return snapshot.options.books.find((book) => book.id === id); }
  function characterById(id) { return snapshot.options.characters.find((character) => character.id === id); }

  function setSelected(select, values) {
    const wanted = new Set(values || []);
    [...select.options].forEach((option) => { option.selected = wanted.has(option.value); });
  }

  function render() {
    const series = activeSeries();
    const select = $("#series-select");
    select.innerHTML = snapshot.series.length
      ? snapshot.series.map((item) => `<option value="${esc(item.id)}">${esc(item.name)}</option>`).join("")
      : '<option value="">No series yet</option>';
    if (series) {
      select.value = series.id;
      localStorage.setItem(selectionKey, series.id);
    } else {
      localStorage.removeItem(selectionKey);
    }

    const createBook = $("#series-create-book");
    createBook.innerHTML = '<option value="">No book yet</option>' + snapshot.options.books.map((book) => `<option value="${esc(book.id)}">${esc(book.title)}</option>`).join("");

    const disabled = !series;
    $("#series-delete").disabled = disabled;
    $("#series-save-details").disabled = disabled;
    $("#series-add-event").disabled = disabled || !series.bookIds.length;

    if (!series) {
      $("#series-summary").innerHTML = '<p class="muted">Create a series to begin.</p>';
      $("#series-name").value = "";
      $("#series-world-rules").value = "";
      $("#series-locations").value = "";
      $("#series-terminology").value = "";
      $("#series-history").value = "";
      $("#series-threads").value = "";
      $("#series-characters").innerHTML = snapshot.options.characters.map((item) => `<option value="${esc(item.id)}">${esc(item.name)}</option>`).join("");
      $("#series-visuals").innerHTML = snapshot.options.visualIdentities.map((item) => `<option value="${esc(item.id)}">${esc(item.id)}</option>`).join("");
      $("#series-book-list").innerHTML = '<p class="muted">No active series.</p>';
      $("#series-add-book").innerHTML = '<option value="">No available books</option>';
      $("#series-add-book-button").disabled = true;
      $("#series-timeline-book").innerHTML = '<option value="">Add a book first</option>';
      $("#series-timeline-list").innerHTML = '<p class="muted">No timeline events.</p>';
      return;
    }

    $("#series-summary").innerHTML = `<article class="memory"><strong>${esc(series.name)}</strong><p>${series.bookIds.length} books • ${series.sharedCharacters.length} shared characters • ${series.timeline.length} timeline events</p><small>${series.unresolvedThreads.length} unresolved cross-book threads</small></article>`;
    $("#series-name").value = series.name;
    $("#series-world-rules").value = series.worldRules.join("\n");
    $("#series-locations").value = series.locations.join("\n");
    $("#series-terminology").value = series.terminology.join("\n");
    $("#series-history").value = series.history.join("\n");
    $("#series-threads").value = series.unresolvedThreads.join("\n");

    const characters = $("#series-characters");
    characters.innerHTML = snapshot.options.characters.map((item) => `<option value="${esc(item.id)}">${esc(item.name)} — ${esc(item.id)}</option>`).join("");
    setSelected(characters, series.sharedCharacters);

    const visuals = $("#series-visuals");
    visuals.innerHTML = snapshot.options.visualIdentities.map((item) => {
      const character = characterById(item.characterId);
      return `<option value="${esc(item.id)}">${esc(character?.name || item.characterId)} — ${esc(item.id)}</option>`;
    }).join("");
    setSelected(visuals, series.visualIdentityIds);

    $("#series-book-list").innerHTML = series.bookIds.length ? series.bookIds.map((bookId, index) => {
      const book = bookById(bookId);
      return `<article class="memory" data-series-book="${esc(bookId)}"><strong>${index + 1}. ${esc(book?.title || bookId)}</strong><small>${esc(bookId)}</small><div class="row"><button type="button" data-series-book-up="${esc(bookId)}" ${index === 0 ? "disabled" : ""}>Move up</button><button type="button" data-series-book-down="${esc(bookId)}" ${index === series.bookIds.length - 1 ? "disabled" : ""}>Move down</button><button type="button" data-series-book-remove="${esc(bookId)}">Remove from series</button></div></article>`;
    }).join("") : '<p class="muted">No books in this series yet.</p>';

    const available = snapshot.options.books.filter((book) => !series.bookIds.includes(book.id));
    $("#series-add-book").innerHTML = available.length
      ? '<option value="">Select a project book</option>' + available.map((book) => `<option value="${esc(book.id)}">${esc(book.title)}</option>`).join("")
      : '<option value="">Every project book is already in this series</option>';
    $("#series-add-book-button").disabled = !available.length;

    $("#series-timeline-book").innerHTML = series.bookIds.length
      ? series.bookIds.map((bookId) => `<option value="${esc(bookId)}">${esc(bookById(bookId)?.title || bookId)}</option>`).join("")
      : '<option value="">Add a book first</option>';
    $("#series-timeline-list").innerHTML = series.timeline.length ? series.timeline.map((event) => `<article class="memory"><strong>${esc(event.date)} — ${esc(bookById(event.bookId)?.title || event.bookId)}</strong><p>${esc(event.description)}</p><small>${esc(event.id)}</small><button type="button" data-series-event-remove="${esc(event.id)}">Remove timeline event</button></article>`).join("") : '<p class="muted">No timeline events.</p>';
  }

  async function refresh(showSuccess = false) {
    try {
      [project, snapshot] = await Promise.all([
        api(`/api/projects/${encodeURIComponent(projectId)}`),
        api(`/api/projects/${encodeURIComponent(projectId)}/series`),
      ]);
      $("#series-project-title").textContent = project.metadata.title;
      $("#series-project-meta").textContent = `${project.metadata.id} • ${snapshot.series.length} series • ${snapshot.options.books.length} project books`;
      $("#back-studio").href = `/?project=${encodeURIComponent(projectId)}`;
      render();
      if (showSuccess) notify("Series state refreshed from durable project storage.", true);
    } catch (error) { notify(error.message); }
  }

  async function createSeries(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      snapshot = await api(`/api/projects/${encodeURIComponent(projectId)}/series`, {
        method: "POST",
        body: JSON.stringify({ name: data.name, bookIds: data.bookId ? [data.bookId] : [] }),
      });
      const created = snapshot.series[snapshot.series.length - 1];
      if (created) localStorage.setItem(selectionKey, created.id);
      form.reset();
      render();
      notify("Series created in the durable project package.", true);
    } catch (error) { notify(error.message); }
  }

  async function saveDetails(event) {
    event.preventDefault();
    const series = activeSeries();
    if (!series) return notify("Create or select a series first.");
    try {
      snapshot = await api(`/api/projects/${encodeURIComponent(projectId)}/series/${encodeURIComponent(series.id)}`, {
        method: "PUT",
        body: JSON.stringify({
          name: $("#series-name").value,
          sharedCharacters: selectedValues($("#series-characters")),
          visualIdentityIds: selectedValues($("#series-visuals")),
          worldRules: lines($("#series-world-rules").value, "World rules"),
          locations: lines($("#series-locations").value, "Locations"),
          terminology: lines($("#series-terminology").value, "Terminology"),
          history: lines($("#series-history").value, "History"),
          unresolvedThreads: lines($("#series-threads").value, "Unresolved threads"),
        }),
      });
      render();
      notify("Series canon saved explicitly.", true);
    } catch (error) { notify(error.message); }
  }

  async function addBook() {
    const series = activeSeries();
    const bookId = $("#series-add-book").value;
    if (!series || !bookId) return notify("Select a series and an existing project book first.");
    try {
      snapshot = await api(`/api/projects/${encodeURIComponent(projectId)}/series/${encodeURIComponent(series.id)}/books`, { method: "POST", body: JSON.stringify({ bookId }) });
      render();
      notify("Book added to series.", true);
    } catch (error) { notify(error.message); }
  }

  async function reorderBook(bookId, delta) {
    const series = activeSeries();
    if (!series) return;
    const ids = [...series.bookIds];
    const index = ids.indexOf(bookId);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    try {
      snapshot = await api(`/api/projects/${encodeURIComponent(projectId)}/series/${encodeURIComponent(series.id)}/books`, { method: "PUT", body: JSON.stringify({ bookIds: ids }) });
      render();
      notify("Series book order saved.", true);
    } catch (error) { notify(error.message); }
  }

  async function removeBook(bookId) {
    const series = activeSeries();
    if (!series) return;
    try {
      snapshot = await api(`/api/projects/${encodeURIComponent(projectId)}/series/${encodeURIComponent(series.id)}/books/${encodeURIComponent(bookId)}`, { method: "DELETE" });
      render();
      notify("Book removed from series; manuscript book was preserved.", true);
    } catch (error) { notify(error.message); }
  }

  async function addTimelineEvent(event) {
    event.preventDefault();
    const series = activeSeries();
    if (!series) return notify("Create or select a series first.");
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    const eventId = globalThis.crypto?.randomUUID ? `series-event-${globalThis.crypto.randomUUID()}` : `series-event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    try {
      snapshot = await api(`/api/projects/${encodeURIComponent(projectId)}/series/${encodeURIComponent(series.id)}/timeline`, {
        method: "POST",
        body: JSON.stringify({ id: eventId, bookId: data.bookId, date: data.date, description: data.description }),
      });
      form.reset();
      render();
      notify("Series timeline event saved.", true);
    } catch (error) { notify(error.message); }
  }

  async function removeTimelineEvent(eventId) {
    const series = activeSeries();
    if (!series) return;
    try {
      snapshot = await api(`/api/projects/${encodeURIComponent(projectId)}/series/${encodeURIComponent(series.id)}/timeline/${encodeURIComponent(eventId)}`, { method: "DELETE" });
      render();
      notify("Series timeline event removed.", true);
    } catch (error) { notify(error.message); }
  }

  async function deleteSeries() {
    const series = activeSeries();
    if (!series) return;
    if (!globalThis.confirm(`Delete series "${series.name}"? Manuscript books will remain in the project.`)) return;
    try {
      snapshot = await api(`/api/projects/${encodeURIComponent(projectId)}/series/${encodeURIComponent(series.id)}`, { method: "DELETE" });
      localStorage.removeItem(selectionKey);
      render();
      notify("Series record deleted. Manuscript books were preserved.", true);
    } catch (error) { notify(error.message); }
  }

  function bind() {
    $("#series-refresh").addEventListener("click", () => refresh(true));
    $("#series-create-form").addEventListener("submit", createSeries);
    $("#series-details-form").addEventListener("submit", saveDetails);
    $("#series-select").addEventListener("change", (event) => { localStorage.setItem(selectionKey, event.target.value); render(); });
    $("#series-add-book-button").addEventListener("click", addBook);
    $("#series-timeline-form").addEventListener("submit", addTimelineEvent);
    $("#series-delete").addEventListener("click", deleteSeries);
    document.addEventListener("click", (event) => {
      const up = event.target.closest?.("[data-series-book-up]");
      const down = event.target.closest?.("[data-series-book-down]");
      const remove = event.target.closest?.("[data-series-book-remove]");
      const removeEvent = event.target.closest?.("[data-series-event-remove]");
      if (up) reorderBook(up.dataset.seriesBookUp, -1);
      else if (down) reorderBook(down.dataset.seriesBookDown, 1);
      else if (remove) removeBook(remove.dataset.seriesBookRemove);
      else if (removeEvent) removeTimelineEvent(removeEvent.dataset.seriesEventRemove);
    });
  }

  document.addEventListener("DOMContentLoaded", () => { bind(); refresh(); });
})();
