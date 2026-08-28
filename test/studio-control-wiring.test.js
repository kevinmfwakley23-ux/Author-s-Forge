const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const { join } = require("node:path");
const { test } = require("node:test");

const root = join(__dirname, "..");
const html = await readFile(join(root, "public/index.html"), "utf8");
const app = await readFile(join(root, "public/app.js"), "utf8");
const commandCenter = await readFile(join(root, "public/forge-command-center.js"), "utf8");
const workbench = await readFile(join(root, "public/forge-workbench.js"), "utf8");
const clientSource = `${app}\n${commandCenter}\n${workbench}`;

function attributes(tag) {
  return Object.fromEntries(
    [...tag.matchAll(/([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)]
      .slice(1)
      .map((match) => [match[1], match[2] ?? match[3] ?? match[4] ?? ""]),
  );
}

function buttonTags() {
  return [...html.matchAll(/<button\b[^>]*>/gi)].map((match) => match[0]);
}

function formTags() {
  return [...html.matchAll(/<form\b[^>]*>/gi)].map((match) => match[0]);
}

function routeLinks() {
  return [...html.matchAll(/<a\b[^>]*data-route="([^"]+)"[^>]*>/gi)].map((match) => match[1]);
}

test("every declared Studio route has a real destination view", () => {
  const routes = routeLinks();
  assert.ok(routes.length > 0, "Studio must declare at least one route");
  for (const route of routes) {
    assert.match(html, new RegExp(`<[^>]+\\bid=["']${route}["'][^>]*\\bdata-view(?:[ =]|>)`, "i"), `route ${route} has no matching data-view section`);
  }
  assert.equal(new Set(routes).size, routes.length, "duplicate route declarations create ambiguous navigation");
});

test("every static button has a declared execution boundary", () => {
  const buttons = buttonTags();
  assert.equal(buttons.length, 37, "update this contract deliberately when the Studio control surface changes");

  for (const tag of buttons) {
    const attrs = attributes(tag);
    const description = attrs.id || attrs["data-route"] || tag;
    const isRoute = Boolean(attrs["data-route"]);

    if (isRoute) continue;

    if (attrs.id) {
      assert.ok(
        clientSource.includes(`#${attrs.id}`) ||
        clientSource.includes(`getElementById("${attrs.id}")`) ||
        clientSource.includes(`getElementById('${attrs.id}')`) ||
        clientSource.includes(`querySelector("#${attrs.id}")`) ||
        clientSource.includes(`querySelector('#${attrs.id}')`),
        `button ${description} is visible but no client-side wiring references its id`,
      );
      continue;
    }

    assert.equal(attrs.type, "submit", `button ${description} has neither a route nor an id-backed handler`);
  }
});

test("every declared form has a submit boundary in the Studio client", () => {
  const forms = formTags();
  assert.equal(forms.length, 11, "update this contract deliberately when the Studio form surface changes");
  for (const tag of forms) {
    const id = attributes(tag).id;
    assert.ok(id, `form without an id cannot be deterministically wired: ${tag}`);
    assert.ok(clientSource.includes(id), `form ${id} is visible but absent from client wiring`);
  }
});

test("dynamic scene controls and all static routes are backed by executable client code", () => {
  assert.match(app, /data-open-scene/);
  assert.match(app, /openSceneFromTree|open-scene|dataset\.openScene/);
  assert.match(app, /function\s+navigate\s*\(/);
  assert.match(app, /addEventListener\(["']click["'][^\n]*data-route|closest\(["']\[data-route\]["']\)/);
});

test("Studio source contains no static button that claims completion without an id, route, or form boundary", () => {
  for (const tag of buttonTags()) {
    const attrs = attributes(tag);
    assert.ok(attrs.id || attrs["data-route"] || attrs.type === "submit", `unclassified button: ${tag}`);
  }
});
