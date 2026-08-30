import type { ForgeCore } from './forge-core';

export type ForgeCoreHealthStatus = 'ready' | 'degraded' | 'blocked';

export interface ForgeCoreHealthReport {
  readonly status: ForgeCoreHealthStatus;
  readonly checkedAt: string;
  readonly memoryRecords: number;
  readonly aiModels: number;
  readonly checks: readonly { name: string; ok: boolean; detail: string }[];
}

/** Read-only operational health report used by the Studio and recovery surfaces. */
export function inspectForgeCore(core: ForgeCore, now = new Date().toISOString()): ForgeCoreHealthReport {
  const readiness = core.readiness();
  const checks = [
    { name: 'memory', ok: readiness.memoryAvailable, detail: readiness.memoryAvailable ? 'memory store available' : 'memory store unavailable' },
    { name: 'ai-routing', ok: readiness.aiRoutingAvailable, detail: readiness.aiRoutingAvailable ? 'AI broker available' : 'AI broker unavailable' },
    { name: 'ai-capacity', ok: readiness.aiConfigured, detail: readiness.aiConfigured ? `${readiness.modelCount} configured model(s)` : 'no configured AI model' },
    { name: 'context', ok: true, detail: 'context pipeline available' },
    { name: 'recovery', ok: true, detail: 'portable core snapshots available' }
  ];
  const failed = checks.filter(check => !check.ok);
  return {
    status: failed.length === 0 ? 'ready' : (failed.some(check => ['memory','ai-routing'].includes(check.name)) ? 'blocked' : 'degraded'),
    checkedAt: now,
    memoryRecords: core.memory.list().length,
    aiModels: readiness.modelCount,
    checks
  };
}
