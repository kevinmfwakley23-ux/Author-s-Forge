import { VisualGenerationPlan, scoreVisualContinuity } from '../domain/visual-continuity';

export interface VisualProviderRequest { readonly plan: VisualGenerationPlan; readonly operation: 'generate'|'edit'|'variation'|'upscale'; readonly referenceUris: readonly string[]; }
export interface VisualProviderResult { readonly assetUri: string; readonly provider: string; readonly model: string; readonly metadata?: Readonly<Record<string, unknown>>; }
export interface VisualProvider { readonly id: string; readonly healthy?: boolean; readonly generate: (request: VisualProviderRequest) => Promise<VisualProviderResult>; }
export interface VisualQualityReport { readonly passed: boolean; readonly score: number; readonly failures: readonly string[]; }
export interface VisualProductionResult { readonly asset: VisualProviderResult; readonly quality: VisualQualityReport; readonly providerAttempts: readonly string[]; }

/** Provider-neutral image production coordinator. Providers can be commercial, local, or gateway-backed. */
export class VisualProductionPipeline {
  constructor(private readonly providers: readonly VisualProvider[]) {}

  async produce(input: {
    plan: VisualGenerationPlan;
    operation?: VisualProviderRequest['operation'];
    references?: readonly string[];
    quality: {
      expectedCharacterTraits: readonly string[];
      expectedStyleTags: readonly string[];
      requiredSignatureItems?: readonly string[];
      expectedCostumeRules?: readonly string[];
    };
    inspect: (asset: VisualProviderResult) => Promise<{
      observedCharacterTraits: readonly string[];
      observedStyleTags: readonly string[];
      observedSignatureItems?: readonly string[];
      observedCostumeRules?: readonly string[];
    }>;
    maxProviderAttempts?: number;
  }): Promise<VisualProductionResult> {
    const attempts: string[] = [];
    const maxAttempts = Math.max(1, Math.min(input.maxProviderAttempts ?? this.providers.length, this.providers.length));
    const providers = this.providers.filter((provider) => provider.healthy !== false).slice(0, maxAttempts);
    let lastError: unknown = new Error('No healthy visual providers are configured.');
    for (const provider of providers) {
      attempts.push(provider.id);
      try {
        const asset = await provider.generate({ plan: input.plan, operation: input.operation ?? 'generate', referenceUris: input.references ?? input.plan.references.map((r) => r.uri) });
        const observed = await input.inspect(asset);
        const quality = scoreVisualContinuity({ ...input.quality, ...observed });
        if (quality.passed) return { asset, quality, providerAttempts: attempts };
        lastError = new Error(`Visual quality gate failed: ${quality.failures.join(', ')}`);
      } catch (error) {
        lastError = error;
      }
    }
    throw new Error(`Visual production exhausted ${attempts.length} provider attempt(s): ${lastError instanceof Error ? lastError.message : String(lastError)}`);
  }
}
