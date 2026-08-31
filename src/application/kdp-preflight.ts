import { calculateKdpCoverLayout, type PublishingConfiguration } from "../domain/book-cover-studio";
import {
  createKdpPreflightReport,
  type KdpCoverFileFacts,
  type KdpInteriorFileFacts,
  type KdpPreflightReport,
} from "../domain/kdp-preflight";

export interface KdpProductionPreflightRequest {
  readonly id: string;
  readonly projectId: string;
  readonly publishing: PublishingConfiguration;
  readonly interiorHasBleed: boolean;
  readonly interior: KdpInteriorFileFacts;
  readonly cover: KdpCoverFileFacts;
  readonly now?: string;
}

/**
 * Application boundary for KDP print preflight.
 *
 * Expected cover dimensions are always derived from Forge's authoritative
 * production configuration so callers cannot accidentally validate a cover
 * against hand-entered geometry that disagrees with the book-cover system.
 */
export class KdpPreflightService {
  audit(request: KdpProductionPreflightRequest): KdpPreflightReport {
    const layout = calculateKdpCoverLayout(request.publishing);
    return createKdpPreflightReport({
      id: request.id,
      projectId: request.projectId,
      binding: request.publishing.binding,
      trimWidthInches: request.publishing.trimWidthInches,
      trimHeightInches: request.publishing.trimHeightInches,
      pageCount: request.publishing.pageCount,
      interiorHasBleed: request.interiorHasBleed,
      expectedCoverWidthInches: layout.dimensions.widthInches,
      expectedCoverHeightInches: layout.dimensions.heightInches,
      interior: request.interior,
      cover: request.cover,
      now: request.now,
    });
  }
}
