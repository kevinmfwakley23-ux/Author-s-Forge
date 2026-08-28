export declare const BOOK_COVER_STUDIO_FORMAT_VERSION: 1;
export declare const COVER_FORMATS: readonly ["ebook", "paperback", "hardcover", "series", "boxed-set", "promotional", "audiobook"];
export type CoverFormat = typeof COVER_FORMATS[number];
export declare const BINDINGS: readonly ["paperback", "hardcover"];
export type Binding = typeof BINDINGS[number];
export declare const INTERIOR_TYPES: readonly ["black-white", "premium-color", "standard-color"];
export type InteriorType = typeof INTERIOR_TYPES[number];
export declare const PAPER_TYPES: readonly ["white", "cream", "groundwood"];
export type PaperType = typeof PAPER_TYPES[number];
export declare const COVER_APPROVAL_STATUSES: readonly ["draft", "pending", "approved", "rejected"];
export type CoverApprovalStatus = typeof COVER_APPROVAL_STATUSES[number];
export interface PublishingConfiguration {
    readonly platform: "kdp";
    readonly binding: Binding;
    readonly interiorType?: InteriorType;
    readonly paperType?: PaperType;
    readonly trimWidthInches: number;
    readonly trimHeightInches: number;
    readonly pageCount: number;
    readonly bleedInches: number;
    readonly readingDirection: "ltr" | "rtl";
}
export interface CoverDimensions {
    readonly widthInches: number;
    readonly heightInches: number;
    readonly spineWidthInches: number;
    readonly bleedInches: number;
    readonly wrapInches: number;
}
export interface CoverZones {
    readonly front: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    readonly spine: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    readonly back: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    readonly barcodeSafeArea: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    readonly trim: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    readonly safeMarginInches: number;
}
export interface CoverValidationIssue {
    readonly code: string;
    readonly severity: "error" | "warning";
    readonly message: string;
}
export interface BookCoverPlan {
    readonly formatVersion: typeof BOOK_COVER_STUDIO_FORMAT_VERSION;
    readonly id: string;
    readonly projectId: string;
    readonly bookId: string;
    readonly format: CoverFormat;
    readonly publishing: PublishingConfiguration;
    readonly dimensions: CoverDimensions;
    readonly zones: CoverZones;
    readonly title: string;
    readonly author: string;
    readonly frontPrompt: string;
    readonly spineText: string;
    readonly backText: string;
    readonly artworkUri?: string;
    readonly outputUri?: string;
    readonly outputFormat: "pdf" | "jpeg" | "png" | "tiff";
    readonly dpi: number;
    readonly version: number;
    readonly approvalStatus: CoverApprovalStatus;
    readonly createdAt: string;
    readonly updatedAt: string;
}
export interface CreateBookCoverPlanInput extends Omit<BookCoverPlan, "formatVersion" | "dimensions" | "zones" | "createdAt" | "updatedAt"> {
    readonly now?: string;
}
export declare function calculateKdpCoverLayout(config: PublishingConfiguration): {
    dimensions: CoverDimensions;
    zones: CoverZones;
};
export declare function validatePublishingConfiguration(config: PublishingConfiguration): void;
export declare function validateBookCoverFile(plan: BookCoverPlan, file: {
    readonly format: BookCoverPlan["outputFormat"];
    readonly widthInches: number;
    readonly heightInches: number;
    readonly dpi: number;
    readonly sizeBytes: number;
    readonly hasFront: boolean;
    readonly hasBack: boolean;
    readonly hasSpine: boolean;
    readonly hasCropMarks: boolean;
    readonly hasTemplateText: boolean;
    readonly flattened: boolean;
    readonly fontsEmbedded: boolean;
    readonly encrypted: boolean;
}): CoverValidationIssue[];
export declare function createBookCoverPlan(input: CreateBookCoverPlanInput): BookCoverPlan;
