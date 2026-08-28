export declare const MANUSCRIPT_PRODUCTION_FORMAT_VERSION: 1;
export declare const PRODUCTION_FORMATS: readonly ["docx", "pdf", "epub", "kdp-docx", "kdp-pdf", "kdp-epub"];
export type ProductionFormat = typeof PRODUCTION_FORMATS[number];
export declare const FRONT_MATTER_KINDS: readonly ["title-page", "copyright", "dedication", "epigraph", "toc"];
export type FrontMatterKind = typeof FRONT_MATTER_KINDS[number];
export declare const BACK_MATTER_KINDS: readonly ["author-biography", "acknowledgments", "about-the-author", "back-matter", "series-information"];
export type BackMatterKind = typeof BACK_MATTER_KINDS[number];
export interface ProductionSection {
    readonly kind: FrontMatterKind | BackMatterKind;
    readonly title?: string;
    readonly body: string;
}
export interface ProductionChapter {
    readonly id: string;
    readonly number: number;
    readonly title: string;
    readonly scenes: readonly ProductionScene[];
}
export interface ProductionScene {
    readonly id: string;
    readonly title: string;
    readonly body: string;
}
export interface ProductionManuscript {
    readonly projectId: string;
    readonly bookId: string;
    readonly title: string;
    readonly subtitle?: string;
    readonly author: string;
    readonly chapters: readonly ProductionChapter[];
    readonly frontMatter: readonly ProductionSection[];
    readonly backMatter: readonly ProductionSection[];
    readonly seriesName?: string;
    readonly seriesNumber?: number;
}
export interface ProductionOptions {
    readonly format: ProductionFormat;
    readonly pageSize?: "letter" | "a4" | "6x9" | "5x8";
    readonly pageNumbers?: boolean;
    readonly runningHeader?: string;
    readonly runningFooter?: string;
    readonly includeTitlePage?: boolean;
    readonly includeToc?: boolean;
}
export interface ProductionArtifact {
    readonly formatVersion: typeof MANUSCRIPT_PRODUCTION_FORMAT_VERSION;
    readonly id: string;
    readonly projectId: string;
    readonly bookId: string;
    readonly format: ProductionFormat;
    readonly mimeType: string;
    readonly fileName: string;
    readonly byteLength: number;
    readonly sha256: string;
    readonly generatedAt: string;
    readonly contentBase64: string;
}
export interface ProductionValidationIssue {
    readonly code: string;
    readonly severity: "error" | "warning";
    readonly message: string;
}
export declare function validateProductionManuscript(input: ProductionManuscript): void;
export declare function validateProductionOptions(options: ProductionOptions): void;
export declare function normalizeProductionManuscript(input: ProductionManuscript): ProductionManuscript;
export declare function requiredFrontMatter(manuscript: ProductionManuscript): readonly FrontMatterKind[];
export declare function requiredBackMatter(): readonly BackMatterKind[];
export declare function validateProductionArtifact(artifact: ProductionArtifact): ProductionValidationIssue[];
export declare function mimeFor(format: ProductionFormat): string;
export declare function extensionFor(format: ProductionFormat): string;
