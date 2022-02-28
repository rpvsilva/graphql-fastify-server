import NodeCache from 'node-cache';
import { Redis } from 'ioredis';
import { Cache } from './types/cache';

const cache = (config: Cache) => {
  const { defaultTTL } = config;

  const client = cacheClient(config);

  return {
    get: async (key: string) => client.get<string>(key),
    set: (key: string, value: string, ttl = defaultTTL) => client.set<string>(key, value, ttl),
  };
};

const redisCache = (storage: Redis) => {
  return {
    get: (key: string) => storage.get(key),
    set: (key: string, value: string, ttl: number) => storage.set(key, value, 'ex', ttl),
  };
};

function cacheClient(config: Cache) {
  const { storage } = config;

  if (storage !== 'memory') return redisCache(storage);

  return new NodeCache({
    stdTTL: config.defaultTTL,
  });
}

export default cache;
