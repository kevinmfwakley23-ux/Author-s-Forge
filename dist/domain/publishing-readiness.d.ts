export declare const PUBLISHING_READINESS_FORMAT_VERSION: 1;
export type ReadinessStatus = "passed" | "attention";
export type ReadinessSeverity = "error" | "warning";
export type ReadinessCategory = "manuscript" | "cover" | "metadata" | "formatting" | "images" | "table-of-contents" | "pagination" | "production";
export interface ReadinessCheck {
    readonly id: string;
    readonly category: ReadinessCategory;
    readonly label: string;
    readonly status: ReadinessStatus;
    readonly severity: ReadinessSeverity;
    readonly message: string;
    readonly remediation?: string;
}
export interface PublishingReadinessInput {
    readonly manuscript?: {
        readonly title?: string;
        readonly author?: string;
        readonly chapters?: readonly {
            title: string;
            number: number;
        }[];
        readonly hasTitlePage?: boolean;
        readonly hasCopyrightPage?: boolean;
        readonly hasDedication?: boolean;
        readonly hasEpigraph?: boolean;
        readonly hasTableOfContents?: boolean;
        readonly hasBiography?: boolean;
        readonly hasAcknowledgments?: boolean;
        readonly hasAboutTheAuthor?: boolean;
        readonly hasBackMatter?: boolean;
        readonly hasSeriesInformation?: boolean;
        readonly pageCount?: number;
    };
    readonly cover?: {
        readonly format?: "ebook" | "paperback" | "hardcover" | "series" | "boxed-set" | "promotional" | "audiobook";
        readonly widthInches?: number;
        readonly heightInches?: number;
        readonly hasFront?: boolean;
        readonly hasBack?: boolean;
        readonly hasSpine?: boolean;
        readonly hasBarcodeSafeArea?: boolean;
        readonly hasBleed?: boolean;
        readonly hasTrim?: boolean;
        readonly hasSafeMargins?: boolean;
        readonly validated?: boolean;
        readonly fileType?: string;
    };
    readonly metadata?: {
        readonly title?: string;
        readonly author?: string;
        readonly description?: string;
        readonly keywords?: readonly string[];
        readonly categories?: readonly string[];
    };
    readonly formatting?: {
        readonly fileTypes?: readonly string[];
        readonly validated?: boolean;
        readonly pageNumbering?: boolean;
        readonly headersFooters?: boolean;
    };
    readonly images?: {
        readonly count?: number;
        readonly allResolved?: boolean;
        readonly allApproved?: boolean;
        readonly resolutionValidated?: boolean;
    };
    readonly production?: {
        readonly trim?: boolean;
        readonly bleed?: boolean;
        readonly fileTypes?: readonly string[];
        readonly validated?: boolean;
    };
}
export interface PublishingReadinessReport {
    readonly formatVersion: typeof PUBLISHING_READINESS_FORMAT_VERSION;
    readonly id: string;
    readonly projectId: string;
    readonly createdAt: string;
    readonly checks: readonly ReadinessCheck[];
    readonly passedCount: number;
    readonly attentionCount: number;
    readonly status: "ready" | "attention";
}
export declare function createPublishingReadinessReport(input: PublishingReadinessInput & {
    id: string;
    projectId: string;
    now?: string;
}): PublishingReadinessReport;
export declare function validatePublishingReadinessReport(report: PublishingReadinessReport): PublishingReadinessReport;
