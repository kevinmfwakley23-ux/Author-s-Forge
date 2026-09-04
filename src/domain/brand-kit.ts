import type { SpecializedDocument, SpecializedElement, SpecializedStyle } from "./specialized-creation-office";

export const BRAND_KIT_FORMAT_VERSION = 1 as const;
export type BrandColorRole = "primary" | "secondary" | "accent" | "background" | "surface" | "text" | "custom";
export type BrandFontRole = "display" | "heading" | "body" | "caption" | "custom";
export type BrandAssetRole = "primary-logo" | "secondary-logo" | "icon" | "graphic" | "background" | "reference";
export type BrandIssueSeverity = "error" | "warning";

export interface BrandColor {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly role: BrandColorRole;
}
export interface BrandFont {
  readonly id: string;
  readonly label: string;
  readonly family: string;
  readonly role: BrandFontRole;
  readonly weights: readonly number[];
}
export interface BrandAssetRef {
  readonly assetId: string;
  readonly role: BrandAssetRole;
  readonly label?: string;
}
export interface BrandVoiceGuide {
  readonly traits: readonly string[];
  readonly preferredPhrases: readonly string[];
  readonly avoidedPhrases: readonly string[];
}
export interface BrandRestrictions {
  readonly enforceColors: boolean;
  readonly enforceFonts: boolean;
  readonly requireApprovedBrandAssets: boolean;
  readonly lockedElementRoles: readonly string[];
}
export interface BrandKit {
  readonly formatVersion: typeof BRAND_KIT_FORMAT_VERSION;
  readonly id: string;
  readonly forgeProjectId: string;
  readonly name: string;
  readonly description?: string;
  readonly colors: readonly BrandColor[];
  readonly fonts: readonly BrandFont[];
  readonly assets: readonly BrandAssetRef[];
  readonly voice: BrandVoiceGuide;
  readonly guidelines: readonly string[];
  readonly restrictions: BrandRestrictions;
  readonly createdAt: string;
  readonly updatedAt: string;
}
export interface BrandComplianceIssue {
  readonly severity: BrandIssueSeverity;
  readonly code: string;
  readonly message: string;
  readonly surfaceId?: string;
  readonly elementId?: string;
}
export interface BrandComplianceReport {
  readonly brandKitId: string;
  readonly documentId: string;
  readonly compliant: boolean;
  readonly issues: readonly BrandComplianceIssue[];
  readonly checkedAt: string;
}
export interface BrandApplicationChange {
  readonly surfaceId: string;
  readonly elementId: string;
  readonly property: "fontFamily" | "fill" | "locked";
  readonly before: string | boolean | null;
  readonly after: string | boolean;
  readonly reason: string;
}
export interface BrandApplicationProposal {
  readonly brandKitId: string;
  readonly sourceDocumentId: string;
  readonly candidate: SpecializedDocument;
  readonly changes: readonly BrandApplicationChange[];
  readonly compliance: BrandComplianceReport;
}

const COLOR_ROLES: readonly BrandColorRole[] = ["primary", "secondary", "accent", "background", "surface", "text", "custom"];
const FONT_ROLES: readonly BrandFontRole[] = ["display", "heading", "body", "caption", "custom"];
const ASSET_ROLES: readonly BrandAssetRole[] = ["primary-logo", "secondary-logo", "icon", "graphic", "background", "reference"];
const HEX = /^#[0-9a-f]{6}$/i;

export function createBrandKit(input: {
  id: string; forgeProjectId: string; name: string; description?: string; colors?: readonly BrandColor[]; fonts?: readonly BrandFont[];
  assets?: readonly BrandAssetRef[]; voice?: Partial<BrandVoiceGuide>; guidelines?: readonly string[]; restrictions?: Partial<BrandRestrictions>; now?: string;
}): BrandKit {
  const now = timestamp(input.now);
  return validateBrandKit({
    formatVersion: BRAND_KIT_FORMAT_VERSION,
    id: identifier(input.id, "Brand Kit id"),
    forgeProjectId: identifier(input.forgeProjectId, "Brand Kit Forge project id"),
    name: text(input.name, "Brand Kit name", 160),
    ...(input.description?.trim() ? { description: text(input.description, "Brand Kit description", 4_000) } : {}),
    colors: input.colors ?? [],
    fonts: input.fonts ?? [],
    assets: input.assets ?? [],
    voice: { traits: input.voice?.traits ?? [], preferredPhrases: input.voice?.preferredPhrases ?? [], avoidedPhrases: input.voice?.avoidedPhrases ?? [] },
    guidelines: input.guidelines ?? [],
    restrictions: {
      enforceColors: input.restrictions?.enforceColors ?? true,
      enforceFonts: input.restrictions?.enforceFonts ?? true,
      requireApprovedBrandAssets: input.restrictions?.requireApprovedBrandAssets ?? true,
      lockedElementRoles: input.restrictions?.lockedElementRoles ?? ["brand", "legal"],
    },
    createdAt: now,
    updatedAt: now,
  });
}

export function validateBrandKit(value: unknown): BrandKit {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid Brand Kit.");
  const kit = value as BrandKit;
  if (kit.formatVersion !== BRAND_KIT_FORMAT_VERSION) throw new Error("Unsupported Brand Kit format.");
  const ids = new Set<string>();
  const colors = array(kit.colors, "Brand colors").map((raw) => {
    const color = raw as BrandColor;
    const id = identifier(color.id, "Brand color id"); unique(ids, `color:${id}`, "Brand color id");
    const value = String(color.value ?? "").trim().toLowerCase(); if (!HEX.test(value)) throw new Error(`Brand color "${id}" must use #RRGGBB.`);
    return { id, label: text(color.label, "Brand color label", 120), value, role: allowed(color.role, COLOR_ROLES, "brand color role") };
  });
  const fonts = array(kit.fonts, "Brand fonts").map((raw) => {
    const font = raw as BrandFont;
    const id = identifier(font.id, "Brand font id"); unique(ids, `font:${id}`, "Brand font id");
    const weights = array(font.weights, "Brand font weights").map((weight) => Number(weight));
    if (!weights.length || weights.some((weight) => !Number.isInteger(weight) || weight < 100 || weight > 900 || weight % 100 !== 0)) throw new Error(`Brand font "${id}" has invalid weights.`);
    return { id, label: text(font.label, "Brand font label", 120), family: text(font.family, "Brand font family", 240), role: allowed(font.role, FONT_ROLES, "brand font role"), weights: [...new Set(weights)].sort((a, b) => a - b) };
  });
  const assets = array(kit.assets, "Brand assets").map((raw) => {
    const asset = raw as BrandAssetRef;
    return { assetId: identifier(asset.assetId, "Brand asset id"), role: allowed(asset.role, ASSET_ROLES, "brand asset role"), ...(asset.label?.trim() ? { label: text(asset.label, "Brand asset label", 160) } : {}) };
  });
  const voice = validateVoice(kit.voice);
  const guidelines = stringList(kit.guidelines, "Brand guideline", 80, 2_000);
  const restrictions = validateRestrictions(kit.restrictions);
  const createdAt = timestamp(kit.createdAt), updatedAt = timestamp(kit.updatedAt);
  return {
    formatVersion: BRAND_KIT_FORMAT_VERSION,
    id: identifier(kit.id, "Brand Kit id"), forgeProjectId: identifier(kit.forgeProjectId, "Brand Kit Forge project id"), name: text(kit.name, "Brand Kit name", 160),
    ...(kit.description?.trim() ? { description: text(kit.description, "Brand Kit description", 4_000) } : {}),
    colors, fonts, assets, voice, guidelines, restrictions, createdAt, updatedAt,
  };
}

export function auditBrandCompliance(kitInput: BrandKit, document: SpecializedDocument, now = new Date().toISOString()): BrandComplianceReport {
  const kit = validateBrandKit(kitInput);
  const issues: BrandComplianceIssue[] = [];
  const allowedColors = new Set(kit.colors.map((color) => color.value.toLowerCase()));
  const allowedFonts = new Set(kit.fonts.map((font) => normalizeFont(font.family)));
  const approvedAssets = new Set(kit.assets.map((asset) => asset.assetId));
  const lockedRoles = new Set(kit.restrictions.lockedElementRoles.map((role) => role.toLowerCase()));

  for (const surface of document.surfaces) {
    for (const element of surface.elements) {
      const role = String(element.role ?? "").toLowerCase();
      if (kit.restrictions.enforceColors) {
        for (const [property, raw] of [["fill", element.style.fill], ["stroke", element.style.stroke]] as const) {
          if (!raw || !HEX.test(raw)) continue;
          if (!allowedColors.has(raw.toLowerCase())) issues.push({ severity: "error", code: `brand-${property}`, message: `${property} ${raw} is not an approved brand color.`, surfaceId: surface.id, elementId: element.id });
        }
      }
      if (kit.restrictions.enforceFonts && element.kind === "text" && element.style.fontFamily && !allowedFonts.has(normalizeFont(element.style.fontFamily))) {
        issues.push({ severity: "error", code: "brand-font", message: `Font ${element.style.fontFamily} is not an approved brand font.`, surfaceId: surface.id, elementId: element.id });
      }
      if (lockedRoles.has(role) && !element.locked) issues.push({ severity: "error", code: "brand-lock", message: `Role ${role || element.id} must be locked by Brand Kit policy.`, surfaceId: surface.id, elementId: element.id });
      if (kit.restrictions.requireApprovedBrandAssets && role === "brand" && element.assetId && !approvedAssets.has(element.assetId)) {
        issues.push({ severity: "error", code: "brand-asset", message: `Brand element uses unapproved asset ${element.assetId}.`, surfaceId: surface.id, elementId: element.id });
      }
    }
  }
  if (kit.restrictions.enforceColors && !kit.colors.length) issues.push({ severity: "warning", code: "brand-palette-empty", message: "Color enforcement is enabled but the Brand Kit has no approved colors." });
  if (kit.restrictions.enforceFonts && !kit.fonts.length) issues.push({ severity: "warning", code: "brand-fonts-empty", message: "Font enforcement is enabled but the Brand Kit has no approved fonts." });
  return { brandKitId: kit.id, documentId: document.id, compliant: !issues.some((issue) => issue.severity === "error"), issues, checkedAt: timestamp(now) };
}

export function proposeBrandApplication(kitInput: BrandKit, source: SpecializedDocument, now = new Date().toISOString()): BrandApplicationProposal {
  const kit = validateBrandKit(kitInput);
  const changes: BrandApplicationChange[] = [];
  const lockedRoles = new Set(kit.restrictions.lockedElementRoles.map((role) => role.toLowerCase()));
  const candidate: SpecializedDocument = {
    ...clone(source),
    surfaces: source.surfaces.map((surface) => ({ ...surface, elements: surface.elements.map((element) => brandElement(surface.id, element, kit, lockedRoles, changes)) })),
    styleTokens: { ...source.styleTokens, ...brandStyleTokens(kit) },
    updatedAt: timestamp(now),
  };
  return { brandKitId: kit.id, sourceDocumentId: source.id, candidate, changes, compliance: auditBrandCompliance(kit, candidate, now) };
}

function brandElement(surfaceId: string, element: SpecializedElement, kit: BrandKit, lockedRoles: Set<string>, changes: BrandApplicationChange[]): SpecializedElement {
  const role = String(element.role ?? "").toLowerCase();
  let style: SpecializedStyle = { ...element.style };
  let locked = element.locked;
  if (element.kind === "text" && kit.fonts.length) {
    const targetFont = pickFont(kit, role);
    if (targetFont && normalizeFont(style.fontFamily ?? "") !== normalizeFont(targetFont.family)) {
      changes.push({ surfaceId, elementId: element.id, property: "fontFamily", before: style.fontFamily ?? null, after: targetFont.family, reason: `Apply approved ${targetFont.role} font.` });
      style = { ...style, fontFamily: targetFont.family };
    }
  }
  if (kit.colors.length && (element.kind === "text" || element.kind === "shape" || element.kind === "background" || element.kind === "frame" || element.kind === "panel")) {
    const targetColor = pickColor(kit, role, element.kind);
    if (targetColor && String(style.fill ?? "").toLowerCase() !== targetColor.value) {
      changes.push({ surfaceId, elementId: element.id, property: "fill", before: style.fill ?? null, after: targetColor.value, reason: `Apply approved ${targetColor.role} color.` });
      style = { ...style, fill: targetColor.value };
    }
  }
  if (lockedRoles.has(role) && !locked) {
    changes.push({ surfaceId, elementId: element.id, property: "locked", before: false, after: true, reason: `Lock role ${role} under Brand Kit policy.` });
    locked = true;
  }
  return { ...element, style, locked };
}

function pickFont(kit: BrandKit, role: string): BrandFont | undefined {
  const desired: BrandFontRole = ["title", "headline"].includes(role) ? "display" : ["subhead", "brand", "cta"].includes(role) ? "heading" : ["caption", "legal"].includes(role) ? "caption" : "body";
  return kit.fonts.find((font) => font.role === desired) ?? kit.fonts.find((font) => font.role === "body") ?? kit.fonts[0];
}
function pickColor(kit: BrandKit, role: string, kind: string): BrandColor | undefined {
  const desired: BrandColorRole = kind === "background" ? "background" : ["title", "headline", "brand"].includes(role) ? "primary" : role === "cta" ? "accent" : kind === "text" ? "text" : "secondary";
  return kit.colors.find((color) => color.role === desired) ?? kit.colors.find((color) => color.role === "primary") ?? kit.colors[0];
}
function brandStyleTokens(kit: BrandKit): Record<string, string | number> {
  const result: Record<string, string | number> = {};
  for (const color of kit.colors) if (!(color.role in result)) result[`brand.color.${color.role}`] = color.value;
  for (const font of kit.fonts) if (!(`brand.font.${font.role}` in result)) result[`brand.font.${font.role}`] = font.family;
  return result;
}
function validateVoice(value: unknown): BrandVoiceGuide {
  const voice = value && typeof value === "object" && !Array.isArray(value) ? value as BrandVoiceGuide : { traits: [], preferredPhrases: [], avoidedPhrases: [] };
  return { traits: stringList(voice.traits, "Brand voice trait", 40, 160), preferredPhrases: stringList(voice.preferredPhrases, "Preferred phrase", 100, 500), avoidedPhrases: stringList(voice.avoidedPhrases, "Avoided phrase", 100, 500) };
}
function validateRestrictions(value: unknown): BrandRestrictions {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Brand restrictions are required.");
  const restriction = value as BrandRestrictions;
  return { enforceColors: Boolean(restriction.enforceColors), enforceFonts: Boolean(restriction.enforceFonts), requireApprovedBrandAssets: Boolean(restriction.requireApprovedBrandAssets), lockedElementRoles: stringList(restriction.lockedElementRoles, "Locked brand role", 40, 120).map((role) => role.toLowerCase()) };
}
function stringList(value: unknown, label: string, maxItems: number, maxLength: number): string[] { const values = array(value, `${label}s`).map((item) => text(item, label, maxLength)); if (values.length > maxItems) throw new Error(`${label}s exceed ${maxItems} items.`); return [...new Set(values)]; }
function array(value: unknown, label: string): readonly unknown[] { if (!Array.isArray(value)) throw new Error(`${label} must be an array.`); return value; }
function identifier(value: unknown, label: string): string { const result = String(value ?? ""); if (!result || result !== result.trim() || result.length > 256) throw new Error(`${label} is required, trimmed, and at most 256 characters.`); return result; }
function text(value: unknown, label: string, max: number): string { const result = String(value ?? "").trim(); if (!result) throw new Error(`${label} is required.`); if (result.length > max) throw new Error(`${label} exceeds ${max} characters.`); return result; }
function timestamp(value?: string): string { const result = value ?? new Date().toISOString(); if (Number.isNaN(Date.parse(result))) throw new Error("Brand Kit timestamp is invalid."); return result; }
function allowed<T extends string>(value: unknown, values: readonly T[], label: string): T { if (typeof value !== "string" || !values.includes(value as T)) throw new Error(`Invalid ${label}.`); return value as T; }
function unique(set: Set<string>, value: string, label: string): void { if (set.has(value)) throw new Error(`Duplicate ${label} "${value.split(":").at(-1)}".`); set.add(value); }
function normalizeFont(value: string): string { return String(value).trim().replace(/["']/g, "").toLowerCase(); }
function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
