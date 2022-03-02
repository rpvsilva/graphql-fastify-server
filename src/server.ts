import { renderPlaygroundPage } from 'graphql-playground-html';
import LRU, { Lru } from 'tiny-lru';
import { GraphQLBody, GraphQLFastifyConfig } from './types/server';
import { CompiledQuery, compileQuery, isCompiledQuery } from 'graphql-jit';
import { parse } from 'graphql';
import { postMiddleware } from './middlewares';
import { GetCacheKey, GraphqlFastifyCache } from './types/cache';
import cache from './cache';
import { generateCacheKey, getCacheTtl, isIntrospectionQuery } from './utils';
import { FastifyInstance } from 'fastify';

class GraphQLFastify {
  private app: FastifyInstance | undefined;
  private queriesCache: Lru<CompiledQuery>;
  private config: GraphQLFastifyConfig;
  private cache: GraphqlFastifyCache | undefined;

  constructor(config: GraphQLFastifyConfig) {
    this.config = config;
    this.queriesCache = LRU(1024);

    if (config.cache) {
      this.cache = cache(config.cache);
    }
  }

  public applyMiddleware = (config: { app: FastifyInstance; path: '/' }): void => {
    const { app, path } = config;

    this.app = app;

    this.enableGraphQLRequests(path);

    this.configPlayground();
  };

  private getCacheKey = ({
    query,
    variables,
    authorization,
    extraCacheKeyData,
  }: GetCacheKey): string => {
    if (!this.cache) return '';

    return generateCacheKey(query, variables, authorization, extraCacheKeyData);
  };

  private enableGraphQLRequests = (path = '/') => {
    const { schema } = this.config;

    this.app?.post(path, postMiddleware(this.config), async (request, reply) => {
      const { query, operationName, variables = {} } = request.body as GraphQLBody;
      const isIntroQuery = isIntrospectionQuery(operationName);
      const context = this.config.context?.(request) || {};

      const parsedQuery = parse(query);
      const { ttl, isPrivate } =
        getCacheTtl(parsedQuery, this.config.cache?.policy, operationName) || {};

      const cacheKey = this.getCacheKey({
        query,
        variables,
        authorization: isPrivate ? request.headers.authorization : undefined,
        extraCacheKeyData: this.config.cache?.extraCacheKeyData?.(context),
      });

      if (this.cache && !isIntroQuery) {
        const cachedValue = await this.cache.get(cacheKey);

        if (cachedValue) return reply.code(200).send(cachedValue);
      }

      const queryCacheKey = `${query}${operationName}`;
      let compiledQuery = this.queriesCache.get(queryCacheKey);

      if (!compiledQuery) {
        const compilationResult = compileQuery(schema, parsedQuery, operationName);

        if (isCompiledQuery(compilationResult)) {
          compiledQuery = compilationResult;
          this.queriesCache.set(queryCacheKey, compiledQuery);
        } else {
          return compilationResult;
        }
      }

      const executionResult = await compiledQuery.query({}, context, variables);
      const hasErrors = executionResult.errors?.length;

      if (this.cache && !isIntroQuery && ttl && !hasErrors && executionResult.data) {
        this.cache.set(cacheKey, JSON.stringify(executionResult), ttl);
      }

      return reply.status(200).send(executionResult);
    });
  };

  private configPlayground = (playgroundConfig?: GraphQLFastifyConfig['playground']) => {
    const { enabled = true, endpoint = '/' } = playgroundConfig || {};

    if (!enabled) return;

    this.app?.get(endpoint, async (_, reply) => {
      return reply
        .headers({
          'Content-Type': 'text/html',
        })
        .send(
          renderPlaygroundPage({
            ...playgroundConfig,
            endpoint,
          })
        );
    });
  };
}

export default GraphQLFastify;
