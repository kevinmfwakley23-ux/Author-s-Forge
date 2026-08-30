export const SPECIALIZED_CREATION_FORMAT_VERSION = "1.0.0" as const;

export const SPECIALIZED_CREATION_MODES = [
  "comic-book",
  "greeting-card",
  "birthday-card",
  "invitation",
  "flyer",
  "trading-card-game",
] as const;

export type SpecializedCreationMode = (typeof SPECIALIZED_CREATION_MODES)[number];

export type SpecializedCreationStatus = "draft" | "review" | "approved" | "archived";

export type BleedProfile = {
  widthInches: number;
  heightInches: number;
  bleedInches: number;
  safeMarginInches: number;
  dpi: number;
  colorProfile: "sRGB" | "CMYK";
};

export type SpecializedCreationProject = {
  formatVersion: typeof SPECIALIZED_CREATION_FORMAT_VERSION;
  id: string;
  projectId: string;
  mode: SpecializedCreationMode;
  title: string;
  description: string;
  status: SpecializedCreationStatus;
  bleedProfile: BleedProfile;
  createdAt: string;
  updatedAt: string;
};

export type CreateSpecializedCreationInput = {
  id: string;
  projectId: string;
  mode: SpecializedCreationMode;
  title: string;
  description?: string;
  bleedProfile?: Partial<BleedProfile>;
  now?: string;
};

const DEFAULT_BLEED: BleedProfile = {
  widthInches: 8.5,
  heightInches: 11,
  bleedInches: 0.125,
  safeMarginInches: 0.25,
  dpi: 300,
  colorProfile: "sRGB",
};

export function createSpecializedCreationProject(input: CreateSpecializedCreationInput): SpecializedCreationProject {
  const now = input.now ?? new Date().toISOString();
  if (!input.id.trim()) throw new Error("Specialized creation id is required");
  if (!input.projectId.trim()) throw new Error("Project id is required");
  if (!input.title.trim()) throw new Error("Specialized creation title is required");

  return {
    formatVersion: SPECIALIZED_CREATION_FORMAT_VERSION,
    id: input.id,
    projectId: input.projectId,
    mode: input.mode,
    title: input.title.trim(),
    description: input.description?.trim() ?? "",
    status: "draft",
    bleedProfile: {
      ...DEFAULT_BLEED,
      ...input.bleedProfile,
    },
    createdAt: now,
    updatedAt: now,
  };
}

export function validateSpecializedCreationProject(value: SpecializedCreationProject): void {
  if (value.formatVersion !== SPECIALIZED_CREATION_FORMAT_VERSION) throw new Error("Unsupported specialized creation format version");
  if (!SPECIALIZED_CREATION_MODES.includes(value.mode)) throw new Error("Unsupported specialized creation mode");
  if (!value.id || !value.projectId || !value.title.trim()) throw new Error("Invalid specialized creation identity");
  if (value.bleedProfile.widthInches <= 0 || value.bleedProfile.heightInches <= 0) throw new Error("Invalid production dimensions");
  if (value.bleedProfile.bleedInches < 0 || value.bleedProfile.safeMarginInches < 0) throw new Error("Invalid bleed or safe margin");
  if (!Number.isInteger(value.bleedProfile.dpi) || value.bleedProfile.dpi < 72) throw new Error("Invalid production DPI");
}
