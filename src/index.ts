export type { MemoryClass, MemoryAuthority, MemoryProvenance, MemoryRecord, MemoryQuery } from "./domain/memory";
export { createMemoryRecord, MEMORY_FORMAT_VERSION } from "./domain/memory";
export { ProjectMemoryStore } from "./application/project-memory-store";
export type { MemoryPromotionDecision, ProjectMemorySnapshot } from "./application/project-memory-store";
export { assembleProjectBrainContext } from "./application/project-brain";
export type { ProjectBrainQuery, ProjectBrainContext } from "./application/project-brain";
export { assembleWritingContext, CONTEXT_ASSEMBLY_FORMAT_VERSION, CONTEXT_INCLUSION_MODES } from "./domain/context-assembly";
export type { ContextInclusionMode, ContextSectionPolicy, ContextAssemblyRequest, ContextSection, AssembledWritingContext } from "./domain/context-assembly";
export { createProductionContextEngineRegistry, CONTEXT_ENGINE_CAPABILITIES } from "./application/context-engine-stack";
export type { ContextEngineCapability } from "./application/context-engine-stack";
export { compressToolResult } from "./application/tool-result-compressor";
export type { ToolResultCompressionInput, ToolResultCompressionResult } from "./application/tool-result-compressor";
export { InMemoryContextOptimizationLedger } from "./application/context-optimization-ledger";
export type { ContextOptimizationLedger, ContextOptimizationLedgerEntry, ContextOptimizationLedgerSummary } from "./application/context-optimization-ledger";
export { createCostGuardedAiGateway, estimateAiRequestCost, AiCostGuardError } from "./application/ai-cost-guard";
export type { AiCostPolicy, AiCostEstimate } from "./application/ai-cost-guard";
export { AiProposalStore } from "./application/ai-proposal-store";
export type { AiProposal, AiProposalKind, AiProposalStatus, ProposalReviewDecision } from "./application/ai-proposal-store";
export { createMarketingCampaign, approveMarketingAsset, scheduleMarketingAsset, MARKETING_CHANNELS } from "./domain/marketing-campaign";
export type { MarketingCampaign, MarketingAsset, MarketingEvidence, MarketingChannel, MarketingAssetStatus } from "./domain/marketing-campaign";
export { createReleaseGateReport, validateReleaseGateReport, RELEASE_GATE_FORMAT_VERSION } from "./domain/release-gate";
export type { ReleaseGateReport, ReleaseGateInput, ReleaseGateBlocker, ReleaseGateStatus, ReleaseBlockerKind } from "./domain/release-gate";
export { createWorkflowGateReport, canAdvanceWorkflow, validateWorkflowGateReport, FORGE_WORKFLOW_STAGES, WORKFLOW_GATE_FORMAT_VERSION } from "./domain/workflow-gate";
export type { WorkflowGateReport, WorkflowGateInput, WorkflowGateCheck, WorkflowStageGate, WorkflowGateStatus, ForgeWorkflowStage } from "./domain/workflow-gate";
export { advanceWorkflow, WORKFLOW_ADVANCE_FORMAT_VERSION } from "./application/workflow-advance";
export type { WorkflowAdvanceRequest, WorkflowAdvanceResult, WorkflowAdvanceDecision } from "./application/workflow-advance";

// Canonical manuscript model.
export {
  createManuscriptState, createBook, createChapter, createScene,
  addBook, addChapter, addScene, insertChapter, insertScene,
  validateManuscriptState, MANUSCRIPT_FORMAT_VERSION
} from "./domain/manuscript";
export type { ManuscriptState, BookRecord, ChapterRecord, SceneRecord, BookLifecycle, ChapterLifecycle, SceneLifecycle } from "./domain/manuscript";

// Durable project foundation.
export {
  createProject, touchProject, withProjectMemories, withProjectCharacters,
  withProjectVisualIdentities, withProjectIllustrationAssetLibrary, withProjectBookCoverPlans,
  withProjectPublishingReadinessReports, withProjectKdpMarketIntelligenceReports,
  withProjectBookPositioningReports, withProjectBookVersionHistories, withProjectAuthorDecisions,
  withProjectSeries, withProjectVoiceProfiles, withProjectAiCollaborationPolicy,
  withProjectHealthReports, withProjectMemoryRelationships, withProjectDeliveryAudits,
  withProjectBookGenome, PROJECT_FORMAT_VERSION
} from "./domain/project";
export type { ProjectState, ProjectMetadata, ProjectStatus } from "./domain/project";
export { FileProjectStore } from "./infrastructure/file-project-store";

// Portable project packages.
export { createProjectPackage, validateProjectPackage, serializeProjectPackage, deserializeProjectPackage, PROJECT_PACKAGE_FORMAT_VERSION, PROJECT_PACKAGE_NAME } from "./domain/project-package";
export type { ForgeProjectPackage, ProjectPackageManifest, ProjectPackageFile, ProjectPackageEncoding } from "./domain/project-package";
export { ProjectPackageService } from "./application/project-package";

// Publication readiness and project health.
export { createPublishingReadinessReport, validatePublishingReadinessReport, PUBLISHING_READINESS_FORMAT_VERSION } from "./domain/publishing-readiness";
export type { PublishingReadinessReport, PublishingReadinessInput, ReadinessCheck, ReadinessCategory, ReadinessStatus, ReadinessSeverity } from "./domain/publishing-readiness";
export { createProjectHealthReport, validateProjectHealthReport, PROJECT_HEALTH_FORMAT_VERSION } from "./domain/project-health";
export type { ProjectHealthReport, ProjectHealthMetrics } from "./domain/project-health";

// Collaboration, relationship memory, and delivery audit.
export { createAiCollaborationPolicy, validateAiCollaborationPolicy, AI_COLLABORATION_FORMAT_VERSION, AI_COLLABORATION_MODES } from "./domain/ai-collaboration";
export type { AiCollaborationPolicy, AiCollaborationMode } from "./domain/ai-collaboration";
export { createMemoryRelationship, validateMemoryRelationship, RELATIONSHIP_MEMORY_FORMAT_VERSION } from "./domain/relationship-memory";
export type { MemoryRelationship } from "./domain/relationship-memory";
export { createDeliveryAuditReport, validateDeliveryAuditReport, DELIVERY_AUDIT_FORMAT_VERSION, DELIVERY_AUDIT_CATEGORIES } from "./domain/delivery-audit";
export type { DeliveryAuditReport, DeliveryAuditCheck, DeliveryAuditCategory, DeliveryAuditSeverity } from "./domain/delivery-audit";

// Author control, versions, series, and voice preservation.
export { createBookSnapshot, validateBookSnapshot, compareBookVersions, rollbackVersion, branchVersion, mergeVersions, BOOK_VERSION_CONTROL_FORMAT_VERSION } from "./domain/book-version-control";
export type { BookSnapshot, BookVersionComparison, BookVersionBranch, BookVersionHistory, VersionChange, BookVersionLabel } from "./domain/book-version-control";
export { AuthorControlService } from "./application/author-control";
export { createAuthorDecision, validateAuthorDecision, applyAuthorOverride, lockCanon, resolveAuthorControl, isCanonLocked, AUTHOR_CONTROL_FORMAT_VERSION } from "./domain/author-control";
export type { AuthorDecision, AuthorDecisionStatus } from "./domain/author-control";
export { createSeries, validateSeriesState, addBookToSeries, addSeriesTimelineEvent, SERIES_FORMAT_VERSION } from "./domain/series";
export type { SeriesState, SeriesTimelineEvent } from "./domain/series";
export { analyzeVoice, createVoiceProfile, compareVoiceToProfile, buildVoiceRewriteBrief, VOICE_PRESERVATION_FORMAT_VERSION } from "./domain/voice-preservation";
export type { VoiceFingerprint, VoiceProfile, VoiceAnalysis, VoiceRewriteRequest } from "./domain/voice-preservation";
