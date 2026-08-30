import { AiModelBroker, AiModelResource, AiModelSelectionRequest } from './ai-model-broker';

export interface AiExecutionRequest extends AiModelSelectionRequest {
  readonly input: unknown;
  readonly maxAttempts?: number;
}

export interface AiExecutionContext {
  readonly resource: AiModelResource;
  readonly attempt: number;
}

export interface AiExecutionResult<T> {
  readonly value: T;
  readonly resource: AiModelResource;
  readonly attempts: number;
  readonly failures: readonly { provider: string; model: string; error: string }[];
}

export type AiExecutor<T> = (input: unknown, context: AiExecutionContext) => Promise<T>;

/** Executes work against the broker's best resource and fails over to other eligible resources. */
export class AiExecutionFallback {
  constructor(private readonly broker: AiModelBroker) {}

  async execute<T>(request: AiExecutionRequest, executor: AiExecutor<T>): Promise<AiExecutionResult<T>> {
    const failures: { provider: string; model: string; error: string }[] = [];
    const attempted = new Set<string>();
    const maxAttempts = Math.max(1, Math.min(request.maxAttempts ?? 8, this.broker.listResources().length || 1));

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const resources = this.broker.listResources().filter((r) => !attempted.has(this.key(r)) && r.healthy !== false);
      if (resources.length === 0) break;
      const brokerView = new AiModelBroker();
      brokerView.setResources(resources);
      let selection;
      try {
        selection = brokerView.select(request);
      } catch (error) {
        failures.push({ provider: 'broker', model: 'selection', error: this.message(error) });
        break;
      }
      attempted.add(this.key(selection.resource));
      try {
        const value = await executor(request.input, { resource: selection.resource, attempt });
        return { value, resource: selection.resource, attempts: attempt, failures };
      } catch (error) {
        failures.push({ provider: selection.resource.provider, model: selection.resource.model, error: this.message(error) });
      }
    }

    const detail = failures.length ? failures.map((failure) => `${failure.provider}/${failure.model}: ${failure.error}`).join('; ') : 'no eligible AI resources';
    throw new Error(`AI execution failed after ${failures.length} attempt(s): ${detail}`);
  }

  private key(resource: AiModelResource): string { return `${resource.provider}::${resource.model}`; }
  private message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
}
