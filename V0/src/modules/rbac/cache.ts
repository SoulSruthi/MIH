/**
 * Upstash KV cache for resolved permission sets.
 * Key: t:{orgId}:rbac:{userId}   TTL: 300s (5 min)
 * Falls back to no-cache when UPSTASH_REDIS_REST_URL is not set (test/local).
 */

const CACHE_TTL_SECONDS = 300;

function getCacheKey(orgId: string, userId: string): string {
  return `t:${orgId}:rbac:${userId}`;
}

async function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const { Redis } = await import('@upstash/redis');
  return new Redis({ url, token });
}

export async function getCachedPermissions(
  orgId: string,
  userId: string,
): Promise<string[] | null> {
  const redis = await getRedis();
  if (!redis) return null;
  const value = await redis.get<string[]>(getCacheKey(orgId, userId));
  return value ?? null;
}

export async function setCachedPermissions(
  orgId: string,
  userId: string,
  permissions: string[],
): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;
  await redis.set(getCacheKey(orgId, userId), permissions, { ex: CACHE_TTL_SECONDS });
}

export async function invalidatePermissionCache(orgId: string, userId: string): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;
  await redis.del(getCacheKey(orgId, userId));
}
