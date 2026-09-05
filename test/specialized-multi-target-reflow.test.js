"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  CREATIVE_TARGET_PRESETS,
  createMultiTargetReflowProposal,
  validateCreativeTargetSpec,
} = require("../dist/application/specialized-creation-multi-target-reflow");
const { createBrandKit } = require("../dist/domain/brand-kit");

function sourceDocument() {
  return {
    formatVersion: 1,
    id: "launch-flyer",
    projectId: "specialized-launch",
    title: "Launch Flyer",
    mode: "flyer",
    surfaces: [{
      id: "front",
      kind: "front",
      label: "Front",
      widthInches: 8.5,
      heightInches: 11,
      bleedInches: 0.125,
      safeMarginInches: 0.25,
      readingOrder: 1,
      elements: [
        {
          id: "headline",
          kind: "text",
          role: "headline",
          box: { x: 0.75, y: 0.75, width: 7, height: 1.25 },
          text: "A Better Launch",
          locked: false,
          zIndex: 2,
          rotationDegrees: 0,
          style: { fontFamily: "Georgia", fontSizePt: 30, fill: "#1f5d3a" },
          metadata: {},
        },
        {
          id: "brand",
          kind: "text",
          role: "brand",
          box: { x: 0.75, y: 9.75, width: 3.5, height: 0.5 },
          text: "Forge House",
          locked: true,
          zIndex: 3,
          rotationDegrees: 0,
          style: { fontFamily: "Arial", fontSizePt: 11, fill: "#1f5d3a" },
          metadata: {},
        },
      ],
    }],
    styleTokens: { primary: "#1f5d3a" },
    createdAt: "2026-09-05T15:00:00.000Z",
    updatedAt: "2026-09-05T15:00:00.000Z",
  };
}

function brandKit() {
  return createBrandKit({
    id: "forge-house",
    forgeProjectId: "forge-project",
    name: "Forge House",
    colors: [{ id: "green", label: "Green", value: "#1f5d3a", role: "primary" }],
    fonts: [
      { id: "display", label: "Display", family: "Georgia", role: "display", weights: [400, 700] },
      { id: "heading", label: "Heading", family: "Arial", role: "heading", weights: [400, 700] },
    ],
    restrictions: {
      enforceColors: true,
      enforceFonts: true,
      requireApprovedBrandAssets: false,
      lockedElementRoles: ["brand"],
    },
    now: "2026-09-05T15:00:00.000Z",
  });
}

test("multi-target proposal preserves source and creates exact raster production profiles", () => {
  const source = sourceDocument();
  const snapshot = JSON.stringify(source);
  const targets = CREATIVE_TARGET_PRESETS.filter((target) => ["social-square-1080", "story-vertical-9x16-1080"].includes(target.id));
  const proposal = createMultiTargetReflowProposal({ source, targets, now: "2026-09-05T15:10:00.000Z" });

  assert.equal(JSON.stringify(source), snapshot, "multi-target reflow must not mutate the saved source document");
  assert.equal(proposal.persisted, false);
  assert.equal(proposal.variants.length, 2);
  for (const variant of proposal.variants) {
    assert.equal(Math.round(variant.profile.widthInches * variant.profile.dpi), variant.target.widthPx);
    assert.equal(Math.round(variant.profile.heightInches * variant.profile.dpi), variant.target.heightPx);
    assert.equal(variant.document.projectId, source.projectId);
    assert.equal(variant.document.surfaces[0].elements[0].id, "headline", "semantic element identity must survive variant creation");
    assert.equal(variant.document.surfaces[0].elements[1].locked, true, "locked author/brand elements must stay locked");
  }
});

test("safe reflow uses one uniform scale so element geometry is not stretched", () => {
  const source = sourceDocument();
  const vertical = CREATIVE_TARGET_PRESETS.find((target) => target.id === "story-vertical-9x16-1080");
  assert.ok(vertical, "vertical preset must exist");
  const proposal = createMultiTargetReflowProposal({ source, targets: [vertical], now: "2026-09-05T15:20:00.000Z" });
  const original = source.surfaces[0].elements[0].box;
  const resized = proposal.variants[0].document.surfaces[0].elements[0].box;
  const widthScale = resized.width / original.width;
  const heightScale = resized.height / original.height;

  assert.ok(Math.abs(widthScale - heightScale) < 0.0001, "width and height must use the same scale factor");
  assert.ok(proposal.variants[0].issues.some((issue) => issue.code === "aspect-ratio-review"), "large aspect changes must be visible to the author");
});

test("Brand Kit compliance is evaluated on every generated candidate", () => {
  const source = sourceDocument();
  const square = CREATIVE_TARGET_PRESETS.find((target) => target.id === "social-square-1080");
  const proposal = createMultiTargetReflowProposal({ source, targets: [square], brandKit: brandKit(), now: "2026-09-05T15:30:00.000Z" });
  const variant = proposal.variants[0];

  assert.ok(variant.brandCompliance, "brand-governed reflow must return compliance evidence");
  assert.equal(variant.brandCompliance.brandKitId, "forge-house");
  assert.equal(variant.brandCompliance.compliant, true);
  assert.equal(variant.issues.some((issue) => issue.code === "brand-compliance"), false);
});

test("unsafe or ambiguous target specs fail closed", () => {
  assert.throws(() => validateCreativeTargetSpec({
    id: "bad target",
    label: "Bad",
    targetClass: "digital",
    widthPx: 1080,
    heightPx: 1080,
    dpi: 144,
    safeMarginPx: 40,
    bleedPx: 0,
    artifactKinds: ["png"],
  }), /id may contain only/i);

  assert.throws(() => validateCreativeTargetSpec({
    id: "bad-bleed",
    label: "Bad bleed",
    targetClass: "digital",
    widthPx: 1080,
    heightPx: 1080,
    dpi: 144,
    safeMarginPx: 40,
    bleedPx: 8,
    artifactKinds: ["png"],
  }), /must not declare print bleed/i);
});