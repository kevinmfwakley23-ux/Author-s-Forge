import { KdpPreflightService, type KdpProductionPreflightRequest } from "./kdp-preflight";
import type { KdpPreflightReport } from "../domain/kdp-preflight";
import { FileKdpPreflightStore } from "../infrastructure/file-kdp-preflight-store";

/**
 * Application boundary that makes production preflight durable and reviewable.
 * Every audit is generated from authoritative production geometry and then
 * appended to an immutable project-scoped history before it is returned.
 */
export class KdpPreflightHistoryService {
  constructor(
    private readonly store: FileKdpPreflightStore,
    private readonly preflight = new KdpPreflightService(),
  ) {}

  async audit(request: KdpProductionPreflightRequest): Promise<KdpPreflightReport> {
    const report = this.preflight.audit(request);
    await this.store.append(report);
    return report;
  }

  async list(projectId: string): Promise<readonly KdpPreflightReport[]> {
    return this.store.list(projectId);
  }

  async latest(projectId: string): Promise<KdpPreflightReport | undefined> {
    return this.store.latest(projectId);
  }
}
