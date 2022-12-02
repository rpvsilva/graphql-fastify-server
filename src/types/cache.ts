/* eslint-disable @typescript-eslint/no-explicit-any */
import cache from '../cache';
import { Redis } from 'ioredis';
import { ObjectOfAny } from '../types/misc';

export type GraphqlFastifyCache = ReturnType<typeof cache>;

export type Cache<Ctx = any, R = any> = {
  defaultTTL: number;
  storage: 'memory' | Redis;
  policy?: CachePolicy<R>;
  extraCacheKeyData?: (context: Ctx) => string | undefined;
};

export type CachePolicy<C = ObjectOfAny> = {
  [key in keyof C]?: {
    ttl: number;
    scope?: 'PUBLIC' | 'PRIVATE';
  };
};

export type GetCacheKey = {
  query: string;
  operationName?: string;
  variables: ObjectOfAny;
  authorization?: string;
  extraCacheKeyData?: string;
};
