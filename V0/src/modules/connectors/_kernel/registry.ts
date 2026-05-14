import type { SourceConnector } from './types';

const connectors = new Map<string, SourceConnector>();

export function registerConnector(connector: SourceConnector): void {
  if (connectors.has(connector.kind)) {
    throw new Error(`Connector '${connector.kind}' is already registered`);
  }
  connectors.set(connector.kind, connector);
}

export function getConnector(kind: string): SourceConnector {
  const c = connectors.get(kind);
  if (!c) throw new Error(`Unknown connector kind: '${kind}'`);
  return c;
}

export function listConnectors(): SourceConnector[] {
  return Array.from(connectors.values());
}

export function hasConnector(kind: string): boolean {
  return connectors.has(kind);
}

/** For testing only — clears the registry between test suites. */
export function _resetRegistry(): void {
  connectors.clear();
}
