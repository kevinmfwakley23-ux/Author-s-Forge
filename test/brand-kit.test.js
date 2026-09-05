"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createBrandKit,
  auditBrandCompliance,
  proposeBrandApplication,
  validateBrandKit,
} = require("../dist/domain/brand-kit");

function documentFixture() {
  return {
    formatVersion: 1,
    id: "flyer-doc",
    projectId: "specialized-1",
    title: "Launch Flyer",
    mode: "flyer",
    surfaces: [{
      id: "front", kind: "front", label: "Front", widthInches: 8.5, heightInches: 11, bleedInches: 0.125, safeMarginInches: 0.25, readingOrder: 1,
      elements: [
        { id: "headline", kind: "text", role: "headline", box: { x: 1, y: 1, width: 6, height: 1 }, text: "Launch", locked: false, zIndex: 1, rotationDegrees: 0, style: { fontFamily: "Comic Sans MS", fontSizePt: 30, fill: "#ff0000" }, metadata: {} },
        { id: "brand-name", kind: "text", role: "brand", box: { x: 1, y: 9, width: 4, height: 0.5 }, text: "Acme", locked: false, zIndex: 2, rotationDegrees: 0, style: { fontFamily: "Papyrus", fontSizePt: 12, fill: "#00ff00" }, metadata: {} },
      ],
    }],
    styleTokens: {}, createdAt: "2026-09-04T12:00:00.000Z", updatedAt: "2026-09-04T12:00:00.000Z",
  };
}

function kitFixture() {
  return createBrandKit({
    id: "brand-1", forgeProjectId: "forge-1", name: "Acme Brand",
    colors: [
      { id: "green", label: "Primary Green", role: "primary", value: "#1f5d3a" },
      { id: "ink", label: "Ink", role: "text", value: "#181713" },
      { id: "gold", label: "Gold", role: "accent", value: "#c89b3c" },
    ],
    fonts: [
      { id: "display", label: "Display", family: "Georgia", role: "display", weights: [400, 700] },
      { id: "heading", label: "Heading", family: "Arial", role: "heading", weights: [400, 700] },
      { id: "body", label: "Body", family: "Arial", role: "body", weights: [400, 700] },
    ],
    guidelines: ["Use generous spacing."],
    restrictions: { enforceColors: true, enforceFonts: true, requireApprovedBrandAssets: true, lockedElementRoles: ["brand", "legal"] },
    now: "2026-09-04T12:00:00.000Z",
  });
}

test("off-brand document fails deterministic color, font, and lock rules", () => {
  const report = auditBrandCompliance(kitFixture(), documentFixture(), "2026-09-04T12:10:00.000Z");
  assert.equal(report.compliant, false);
  assert.ok(report.issues.some((issue) => issue.code === "brand-fill" && issue.elementId === "headline"));
  assert.ok(report.issues.some((issue) => issue.code === "brand-font" && issue.elementId === "headline"));
  assert.ok(report.issues.some((issue) => issue.code === "brand-lock" && issue.elementId === "brand-name"));
});

test("brand application returns a compliant candidate without mutating source", () => {
  const kit = kitFixture();
  const source = documentFixture();
  const sourceSnapshot = JSON.stringify(source);
  const proposal = proposeBrandApplication(kit, source, "2026-09-04T12:20:00.000Z");
  assert.equal(JSON.stringify(source), sourceSnapshot, "proposal must never mutate source document");
  assert.ok(proposal.changes.length >= 5);
  assert.equal(proposal.compliance.compliant, true);
  const headline = proposal.candidate.surfaces[0].elements.find((item) => item.id === "headline");
  const brand = proposal.candidate.surfaces[0].elements.find((item) => item.id === "brand-name");
  assert.equal(headline.style.fontFamily, "Georgia");
  assert.equal(headline.style.fill, "#1f5d3a");
  assert.equal(brand.style.fontFamily, "Arial");
  assert.equal(brand.style.fill, "#1f5d3a");
  assert.equal(brand.locked, true);
  assert.equal(proposal.sourceDocumentId, source.id);
});

test("Brand Kit validation rejects unsafe or ambiguous brand primitives", () => {
  const valid = kitFixture();
  assert.throws(() => validateBrandKit({ ...valid, colors: [{ id: "bad", label: "Bad", role: "primary", value: "red" }] }), /#RRGGBB/);
  assert.throws(() => validateBrandKit({ ...valid, fonts: [{ id: "bad", label: "Bad", family: "Font", role: "body", weights: [350] }] }), /invalid weights/i);
  assert.throws(() => validateBrandKit({ ...valid, restrictions: { ...valid.restrictions, lockedElementRoles: "brand" } }), /must be an array/i);
});
