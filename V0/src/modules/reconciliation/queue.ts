import type { RecItem } from './types';

export type QueueFilters = {
  state?: string;
  severity?: string;
  item_type?: string;
  page?: number;
  per_page?: number;
};

export function applyQueueFilters(items: RecItem[], filters: QueueFilters): RecItem[] {
  let result = [...items];
  if (filters.state) result = result.filter((i) => i.state === filters.state);
  if (filters.severity) result = result.filter((i) => i.severity === filters.severity);
  if (filters.item_type) result = result.filter((i) => i.item_type === filters.item_type);
  return result;
}
