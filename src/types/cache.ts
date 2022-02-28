/* eslint-disable @typescript-eslint/no-explicit-any */
import cache from '../cache';
import { Redis } from 'ioredis';
import { ObjectOfAny } from '../types/misc';

export type GraphqlFastifyCache = ReturnType<typeof cache>;

export type Cache<C = Record<string, never>> = {
  defaultTTL: number;
  storage: 'memory' | Redis;
  policy?: CachePolicy<C>;
  extraCacheKeyData?: (context: ObjectOfAny) => string | undefined;
};

export type CachePolicy<C = Record<string, any>> = {
  [key in keyof C]?: {
    ttl: number;
    scope?: 'PUBLIC' | 'PRIVATE';
  };
};

export type GetCacheKey = {
  query: string;
  variables: ObjectOfAny;
  authorization?: string;
  extraCacheKeyData?: string;
};
