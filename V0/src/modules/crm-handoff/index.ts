export { crmHandoffFunction } from './worker';
export { buildCrmPayload } from './builder';
export type { CrmLeadPayload, CrmLeadResponse } from './builder';
export { postLeadToCrm, CrmHttpError } from './client';
export { guardCrmUrl, SsrfError, isPrivateIp } from './dns-guard';
export {
  getCircuitState,
  recordSuccess,
  recordFailure,
  CircuitOpenError,
} from './circuit-breaker';
