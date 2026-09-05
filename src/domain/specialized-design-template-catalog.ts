import { randomUUID } from "node:crypto";
import {
  SPECIALIZED_DESIGN_TEMPLATE_FORMAT_VERSION,
  validateSpecializedDesignTemplate,
  type SpecializedDesignTemplate,
} from "./specialized-design-template";
import {
  SPECIALIZED_DOCUMENT_FORMAT_VERSION,
  SPECIALIZED_PRODUCTION_PROFILE_VERSION,
  type SpecializedArtifactKind,
  type SpecializedDocument,
  type SpecializedElement,
  type SpecializedProductionProfile,
  type SpecializedSurface,
} from "./specialized-creation-office";
import type { SpecializedCreationMode } from "./specialized-creation";

const BUILTIN_FORGE_PROJECT_ID = "forge-built-in";
const CREATED_AT = "2026-09-05T00:00:00.000Z";

export function builtInSpecializedDesignTemplates(): readonly SpecializedDesignTemplate[] {
  return Object.freeze([
    flyerTemplate(),
    invitationTemplate(),
    greetingCardTemplate(),
    birthdayCardTemplate(),
    comicTemplate(),
    tcgTemplate(),
  ].map(validateSpecializedDesignTemplate));
}

export function findBuiltInSpecializedDesignTemplate(
  id: string,
): SpecializedDesignTemplate | undefined {
  return builtInSpecializedDesignTemplates().find((template) => template.id === id);
}

export function installBuiltInSpecializedDesignTemplate(input: {
  readonly forgeProjectId: string;
  readonly builtInTemplateId: string;
  readonly title?: string;
  readonly now?: string;
}): SpecializedDesignTemplate {
  const source = findBuiltInSpecializedDesignTemplate(input.builtInTemplateId);
  if (!source) throw new Error(`Built-in Specialized design template "${input.builtInTemplateId}" was not found.`);
  const forgeProjectId = identifier(input.forgeProjectId, "Forge project id");
  const now = timestamp(input.now);
  const title = input.title === undefined
    ? source.title
    : requiredText(input.title, "Installed design template title", 180);

  return validateSpecializedDesignTemplate({
    ...clone(source),
    id: `design-template-${randomUUID()}`,
    forgeProjectId,
    title,
    source: {
      kind: "installed-copy",
      specializedProjectId: source.source.specializedProjectId,
      documentId: source.source.documentId,
      profileId: source.source.profileId,
      sourceTemplateId: source.id,
      sourceTemplateVersion: source.version,
    },
    version: 1,
    createdAt: now,
    updatedAt: now,
  });
}

function flyerTemplate(): SpecializedDesignTemplate {
  const mode: SpecializedCreationMode = "flyer";
  const projectId = "builtin-flyer-project";
  const document = documentFor({
    id: "builtin-book-launch-flyer-document",
    projectId,
    title: "Book Launch Flyer Starter",
    mode,
    surfaces: [surface({
      id: "front",
      kind: "front",
      label: "Front",
      width: 8.5,
      height: 11,
      elements: [
        text("eyebrow", "subhead", 0.75, 0.65, 7, 0.35, "NEW RELEASE", 12, true),
        text("headline", "headline", 0.75, 1.15, 7, 1.3, "YOUR BOOK TITLE", 34, false),
        frame("hero-art", "hero-art", 0.75, 2.75, 7, 4.55),
        text("value", "body", 0.75, 7.65, 7, 1, "Add one compelling sentence that gives readers a reason to care.", 16, false),
        text("details", "details", 0.75, 8.9, 4.8, 0.8, "DATE • PLACE • DETAILS", 12, false),
        text("cta", "cta", 0.75, 9.9, 4.8, 0.55, "LEARN MORE", 15, true),
        text("brand", "brand", 6, 9.9, 1.75, 0.55, "YOUR BRAND", 11, true),
      ],
    })],
  });
  return template({
    id: "builtin-book-launch-flyer",
    title: "Book Launch Flyer",
    description: "A clean one-page launch flyer with headline, artwork frame, value statement, event details, CTA, and locked brand position.",
    mode,
    tags: ["book-launch", "flyer", "marketing", "promotion"],
    projectId,
    document,
    profile: profile("builtin-flyer-letter-profile", "US Letter Flyer", 8.5, 11, 300, ["pdf", "svg", "png", "jpeg"]),
  });
}

function invitationTemplate(): SpecializedDesignTemplate {
  const mode: SpecializedCreationMode = "invitation";
  const projectId = "builtin-invitation-project";
  const document = documentFor({
    id: "builtin-elegant-invitation-document",
    projectId,
    title: "Elegant Invitation Starter",
    mode,
    surfaces: [surface({
      id: "front",
      kind: "front",
      label: "Front",
      width: 5,
      height: 7,
      elements: [
        text("host", "subhead", 0.45, 0.6, 4.1, 0.45, "YOU'RE INVITED", 11, true),
        text("event", "headline", 0.45, 1.25, 4.1, 1.1, "EVENT NAME", 27, false),
        shape("divider", "divider", 1.2, 2.55, 2.6, 0.04),
        text("names", "title", 0.45, 2.9, 4.1, 0.75, "HOSTS OR HONOREES", 18, false),
        text("datetime", "details", 0.45, 4, 4.1, 0.8, "SATURDAY • 6:00 PM", 13, false),
        text("venue", "details", 0.45, 4.9, 4.1, 0.8, "VENUE • ADDRESS", 12, false),
        text("rsvp", "cta", 0.45, 6, 4.1, 0.45, "RSVP DETAILS", 12, true),
      ],
    })],
  });
  return template({
    id: "builtin-elegant-invitation",
    title: "Elegant Event Invitation",
    description: "A restrained 5 × 7 invitation layout with hierarchy for event, honorees, date, venue, and RSVP information.",
    mode,
    tags: ["event", "invitation", "elegant", "print"],
    projectId,
    document,
    profile: profile("builtin-invitation-5x7-profile", "Invitation 5 × 7", 5, 7, 300, ["pdf", "svg", "png"]),
  });
}

function greetingCardTemplate(): SpecializedDesignTemplate {
  const mode: SpecializedCreationMode = "greeting-card";
  const projectId = "builtin-greeting-card-project";
  const document = documentFor({
    id: "builtin-warm-greeting-card-document",
    projectId,
    title: "Warm Greeting Card Starter",
    mode,
    surfaces: [
      surface({
        id: "front",
        kind: "front",
        label: "Front",
        width: 5,
        height: 7,
        elements: [
          frame("front-art", "cover-art", 0.5, 0.65, 4, 3.6),
          text("front-message", "headline", 0.5, 4.65, 4, 1.35, "A WARM MESSAGE FOR SOMEONE SPECIAL", 22, false),
        ],
      }),
      surface({
        id: "inside-right",
        kind: "inside-right",
        label: "Inside Right",
        width: 5,
        height: 7,
        readingOrder: 2,
        elements: [
          text("inside-message", "body", 0.65, 1.1, 3.7, 4.4, "Write the heartfelt message here. Keep it personal, specific, and true to the occasion.", 16, false),
          text("signature", "details", 0.65, 5.8, 3.7, 0.45, "WITH LOVE, YOUR NAME", 12, false),
        ],
      }),
      surface({
        id: "back",
        kind: "back",
        label: "Back",
        width: 5,
        height: 7,
        readingOrder: 3,
        elements: [
          text("brand", "brand", 1.1, 6.05, 2.8, 0.4, "YOUR BRAND", 10, true),
        ],
      }),
    ],
  });
  return template({
    id: "builtin-warm-greeting-card",
    title: "Warm Folded Greeting Card",
    description: "A three-surface 5 × 7 folded-card starter with cover artwork, front sentiment, inside message, signature, and locked back-brand position.",
    mode,
    tags: ["card", "greeting", "folded", "sentiment"],
    projectId,
    document,
    profile: profile("builtin-greeting-card-5x7-profile", "Folded 5 × 7", 5, 7, 300, ["pdf", "svg", "png"], true),
  });
}

function birthdayCardTemplate(): SpecializedDesignTemplate {
  const mode: SpecializedCreationMode = "birthday-card";
  const projectId = "builtin-birthday-card-project";
  const document = documentFor({
    id: "builtin-birthday-card-document",
    projectId,
    title: "Birthday Celebration Card Starter",
    mode,
    surfaces: [
      surface({
        id: "front",
        kind: "front",
        label: "Front",
        width: 5,
        height: 7,
        elements: [
          text("birthday-kicker", "subhead", 0.5, 0.7, 4, 0.45, "TODAY IS YOUR DAY", 12, true),
          text("birthday-headline", "headline", 0.5, 1.45, 4, 1.4, "HAPPY BIRTHDAY!", 30, false),
          frame("birthday-art", "celebration-art", 0.65, 3.2, 3.7, 2.7),
        ],
      }),
      surface({
        id: "inside-right",
        kind: "inside-right",
        label: "Inside Right",
        width: 5,
        height: 7,
        readingOrder: 2,
        elements: [
          text("birthday-message", "body", 0.65, 1.15, 3.7, 4.6, "Add a personal birthday message that sounds like you and speaks directly to the person receiving it.", 16, false),
          text("birthday-signature", "details", 0.65, 5.95, 3.7, 0.45, "LOVE, YOUR NAME", 12, false),
        ],
      }),
      surface({
        id: "back",
        kind: "back",
        label: "Back",
        width: 5,
        height: 7,
        readingOrder: 3,
        elements: [text("birthday-brand", "brand", 1.1, 6.05, 2.8, 0.4, "YOUR BRAND", 10, true)],
      }),
    ],
  });
  return template({
    id: "builtin-birthday-celebration-card",
    title: "Birthday Celebration Card",
    description: "A 5 × 7 birthday-card starter with a clear celebration cover, artwork zone, long-form inside message, and brand-safe back panel.",
    mode,
    tags: ["birthday", "card", "folded", "celebration"],
    projectId,
    document,
    profile: profile("builtin-birthday-card-5x7-profile", "Folded 5 × 7", 5, 7, 300, ["pdf", "svg", "png"], true),
  });
}

function comicTemplate(): SpecializedDesignTemplate {
  const mode: SpecializedCreationMode = "comic-book";
  const projectId = "builtin-comic-project";
  const document = documentFor({
    id: "builtin-four-panel-comic-document",
    projectId,
    title: "Four Panel Comic Page Starter",
    mode,
    surfaces: [surface({
      id: "page-1",
      kind: "page",
      label: "Page 1",
      width: 6.625,
      height: 10.25,
      elements: [
        text("page-title", "title", 0.4, 0.4, 5.825, 0.5, "SCENE OR CHAPTER TITLE", 15, false),
        frame("panel-1", "panel-1", 0.4, 1.15, 2.75, 3.5),
        frame("panel-2", "panel-2", 3.475, 1.15, 2.75, 3.5),
        frame("panel-3", "panel-3", 0.4, 4.95, 2.75, 3.9),
        frame("panel-4", "panel-4", 3.475, 4.95, 2.75, 3.9),
        text("page-caption", "caption", 0.4, 9.15, 5.825, 0.45, "CAPTION / PAGE TURN BEAT", 10, false),
      ],
    })],
  });
  return template({
    id: "builtin-four-panel-comic-page",
    title: "Four-Panel Comic Page",
    description: "A balanced four-panel comic starter with editable panel frames, page title, and caption/page-turn zone.",
    mode,
    tags: ["comic", "panels", "page", "storytelling"],
    projectId,
    document,
    profile: profile("builtin-comic-profile", "Comic 6.625 × 10.25", 6.625, 10.25, 300, ["pdf", "cbz", "svg", "png"]),
  });
}

function tcgTemplate(): SpecializedDesignTemplate {
  const mode: SpecializedCreationMode = "trading-card-game";
  const projectId = "builtin-tcg-project";
  const document = documentFor({
    id: "builtin-royal-tcg-card-document",
    projectId,
    title: "Royal Trading Card Starter",
    mode,
    surfaces: [
      surface({
        id: "front",
        kind: "card-front",
        label: "Card Front",
        width: 2.5,
        height: 3.5,
        elements: [
          text("card-name", "title", 0.2, 0.18, 2.1, 0.38, "CARD NAME", 11, true),
          frame("card-art", "card-art", 0.2, 0.65, 2.1, 1.45),
          text("card-rules", "rules", 0.2, 2.2, 2.1, 0.65, "Rules text and abilities go here.", 8, false),
          text("card-stats", "details", 0.2, 2.95, 2.1, 0.28, "POWER 00 • COST 00", 8, true),
        ],
      }),
      surface({
        id: "back",
        kind: "card-back",
        label: "Card Back",
        width: 2.5,
        height: 3.5,
        readingOrder: 2,
        elements: [
          frame("card-back-mark", "brand-mark", 0.55, 0.8, 1.4, 1.4),
          text("card-back-brand", "brand", 0.35, 2.45, 1.8, 0.45, "GAME TITLE", 11, true),
        ],
      }),
    ],
  });
  return template({
    id: "builtin-royal-tcg-card",
    title: "Royal Trading Card",
    description: "A poker-size front/back TCG starter with name, art frame, rules, stats, and a locked brand-centered reverse layout.",
    mode,
    tags: ["tcg", "card", "game", "front-back"],
    projectId,
    document,
    profile: profile("builtin-tcg-profile", "Poker card 2.5 × 3.5", 2.5, 3.5, 300, ["pdf", "svg", "png", "json", "csv"], true),
  });
}

function template(input: {
  id: string;
  title: string;
  description: string;
  mode: SpecializedCreationMode;
  tags: readonly string[];
  projectId: string;
  document: SpecializedDocument;
  profile: SpecializedProductionProfile;
}): SpecializedDesignTemplate {
  return {
    formatVersion: SPECIALIZED_DESIGN_TEMPLATE_FORMAT_VERSION,
    id: input.id,
    forgeProjectId: BUILTIN_FORGE_PROJECT_ID,
    title: input.title,
    description: input.description,
    mode: input.mode,
    tags: [...input.tags],
    assetPolicy: "detached-placeholders",
    document: input.document,
    profile: input.profile,
    source: {
      kind: "built-in",
      specializedProjectId: input.projectId,
      documentId: input.document.id,
      profileId: input.profile.id,
    },
    version: 1,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  };
}

function documentFor(input: {
  id: string;
  projectId: string;
  title: string;
  mode: SpecializedCreationMode;
  surfaces: readonly SpecializedSurface[];
}): SpecializedDocument {
  return {
    formatVersion: SPECIALIZED_DOCUMENT_FORMAT_VERSION,
    id: input.id,
    projectId: input.projectId,
    title: input.title,
    mode: input.mode,
    surfaces: [...input.surfaces],
    styleTokens: {
      "forge.catalog": "starter",
      "forge.catalog.version": 1,
      "forge.layout.intent": "editable-semantic-template",
    },
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  };
}

function surface(input: {
  id: string;
  kind: SpecializedSurface["kind"];
  label: string;
  width: number;
  height: number;
  readingOrder?: number;
  elements: readonly SpecializedElement[];
}): SpecializedSurface {
  return {
    id: input.id,
    kind: input.kind,
    label: input.label,
    widthInches: input.width,
    heightInches: input.height,
    bleedInches: 0.125,
    safeMarginInches: 0.25,
    readingOrder: input.readingOrder ?? 1,
    elements: [...input.elements],
  };
}

function text(
  id: string,
  role: string,
  x: number,
  y: number,
  width: number,
  height: number,
  value: string,
  fontSizePt: number,
  locked: boolean,
): SpecializedElement {
  return {
    id,
    kind: "text",
    role,
    box: { x, y, width, height },
    text: value,
    locked,
    zIndex: 3,
    rotationDegrees: 0,
    style: {
      fontFamily: role === "body" || role === "rules" ? "Arial" : "Georgia",
      fontSizePt,
      fontWeight: role === "headline" || role === "title" || locked ? "bold" : "normal",
      textAlign: "center",
      fill: "#181713",
    },
    metadata: { "forge.catalog.editable": !locked },
  };
}

function frame(
  id: string,
  role: string,
  x: number,
  y: number,
  width: number,
  height: number,
): SpecializedElement {
  return {
    id,
    kind: "frame",
    role,
    box: { x, y, width, height },
    locked: false,
    zIndex: 1,
    rotationDegrees: 0,
    style: {
      fill: "#f4f1ea",
      stroke: "#181713",
      strokeWidthPt: 1,
      opacity: 1,
    },
    metadata: {
      "forge.catalog.placeholder": true,
      "forge.catalog.purpose": role,
    },
  };
}

function shape(
  id: string,
  role: string,
  x: number,
  y: number,
  width: number,
  height: number,
): SpecializedElement {
  return {
    id,
    kind: "shape",
    role,
    box: { x, y, width, height },
    locked: true,
    zIndex: 2,
    rotationDegrees: 0,
    style: { fill: "#181713", opacity: 1 },
    metadata: { "forge.catalog.decorative": true },
  };
}

function profile(
  id: string,
  label: string,
  width: number,
  height: number,
  dpi: number,
  artifactKinds: readonly SpecializedArtifactKind[],
  duplex = false,
): SpecializedProductionProfile {
  return {
    formatVersion: SPECIALIZED_PRODUCTION_PROFILE_VERSION,
    id,
    label,
    widthInches: width,
    heightInches: height,
    bleedInches: 0.125,
    safeMarginInches: 0.25,
    dpi,
    colorIntent: "sRGB",
    artifactKinds: [...artifactKinds],
    duplex,
    notes: [
      "Forge starter semantic template profile.",
      "Replace placeholder copy and frames; run normal Specialized preflight before production.",
    ],
  };
}

function identifier(value: string, label: string): string {
  const result = String(value ?? "").trim();
  if (!/^[A-Za-z0-9_-]+$/.test(result)) throw new Error(`${label} may contain only letters, numbers, underscore, and hyphen.`);
  return result;
}

function requiredText(value: string, label: string, maxLength: number): string {
  const result = String(value ?? "").trim();
  if (!result) throw new Error(`${label} is required.`);
  if (result.length > maxLength) throw new Error(`${label} exceeds ${maxLength} characters.`);
  return result;
}

function timestamp(value?: string): string {
  const raw = value ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(raw))) throw new Error("Design template timestamp must be valid ISO date-time text.");
  return new Date(raw).toISOString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
