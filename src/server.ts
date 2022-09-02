// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./types/globals.d.ts" />

import LRU, { Lru } from 'tiny-lru';
import { GraphQLBody, GraphQLFastifyConfig, PlaygroundOptions } from './types/server';
import { CompiledQuery, compileQuery, isCompiledQuery } from 'graphql-jit';
import { DocumentNode, GraphQLSchema, parse } from 'graphql';
import { postMiddleware } from './middlewares';
import { GetCacheKey, GraphqlFastifyCache } from './types/cache';
import cache from './cache';
import { generateCacheKey, getCacheTtl, getOperation, isIntrospectionQuery } from './utils/cache';
import { FastifyInstance } from 'fastify';
import { ObjectOfAny } from 'types/misc';
import { getSchema } from 'utils/schema';
import playgroundHTML from './playground/index.html';

const REPLACE_PLAYGROUND_ENDPOINT = '<PLAYGROUND_ENDPOINT>';

class GraphQLFastify {
  private app: FastifyInstance | undefined;
  private queriesCache: Lru<CompiledQuery>;
  private config: GraphQLFastifyConfig;
  private cache: GraphqlFastifyCache | undefined;
  private schema: GraphQLSchema;
  private graphiQLPlayground: string;

  constructor(config: GraphQLFastifyConfig) {
    this.config = config;
    this.queriesCache = LRU(1024);
    this.schema = getSchema(config);

    if (config.cache) {
      this.cache = cache(config.cache);
    }

    this.graphiQLPlayground = playgroundHTML.replace(
      REPLACE_PLAYGROUND_ENDPOINT,
      config.playground?.endpoint || '/'
    );
  }

  public applyMiddleware = (config: { app: FastifyInstance; path: '/' }): void => {
    const { app, path } = config;

    this.app = app;

    this.enableGraphQLRequests(path);

    this.configPlayground();

    this.enableLivenessReadiness();

    this.handleServerShutdown();
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
    const { cache, context } = this.config;

    this.app?.post(path, postMiddleware(this.config), async (request, reply) => {
      const { body, headers } = request;
      const { query, operationName, variables = {} } = body as GraphQLBody;
      const ctx = context?.(request) || {};
      const parsedQuery = parse(query);

      this.runMiddlewares(ctx, parsedQuery, operationName);

      const isIntroQuery = isIntrospectionQuery(operationName);

      const { ttl, isPrivate } = getCacheTtl(parsedQuery, cache?.policy, operationName) || {};

      const cacheKey = this.getCacheKey({
        query,
        variables,
        authorization: isPrivate ? headers.authorization : undefined,
        extraCacheKeyData: cache?.extraCacheKeyData?.(context),
      });

      if (this.cache && !isIntroQuery) {
        const cachedValue = await this.cache.get(cacheKey);

        if (cachedValue) return reply.code(200).send(cachedValue);
      }

      const queryCacheKey = `${query}${operationName}`;
      let compiledQuery = this.queriesCache.get(queryCacheKey);

      if (!compiledQuery) {
        const compilationResult = compileQuery(this.schema, parsedQuery, operationName);

        if (isCompiledQuery(compilationResult)) {
          compiledQuery = compilationResult;
          this.queriesCache.set(queryCacheKey, compiledQuery);
        } else {
          return compilationResult;
        }
      }

      const executionResult = await compiledQuery.query({}, ctx, variables);
      const hasErrors = executionResult.errors?.length;

      if (this.cache && !isIntroQuery && ttl && !hasErrors && executionResult.data) {
        this.cache.set(cacheKey, JSON.stringify(executionResult), ttl);
      }

      return reply.status(200).send(executionResult);
    });
  };

  private configPlayground = (playgroundConfig?: PlaygroundOptions) => {
    const { enabled = true, endpoint = '/' } = playgroundConfig || {};

    if (!enabled) return;

    this.app?.get(endpoint, async (_, reply) => {
      return reply
        .headers({
          'Content-Type': 'text/html',
        })
        .send(this.graphiQLPlayground);
    });
  };

  private runMiddlewares = (
    context: ObjectOfAny,
    parsedQuery: DocumentNode,
    operationName?: string
  ) => {
    const { middlewares } = this.config;

    if (!middlewares) return;

    const {
      selectionSet: { selections },
    } = getOperation(parsedQuery.definitions, operationName);

    const fieldsName = selections.flatMap((field) =>
      field.kind === 'Field' ? field.name.value : []
    );

    middlewares.forEach(({ handler, operations }) => {
      const shouldHandlerRun = operations.some((op) => fieldsName.includes(op.toString()));

      if (!shouldHandlerRun) return;

      handler(context);
    });
  };

  private enableLivenessReadiness = () => {
    this.app?.get('/server-health', async (_, reply) => {
      return reply.status(200).send({
        status: 'ok',
      });
    });
  };

  private handleServerShutdown = () => {
    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGILL', 'SIGHUP'];

    signals.forEach((signal) => {
      process.on(signal, async () => {
        // eslint-disable-next-line no-console
        console.log(`[${signal}] Shutting down gracefully...`);

        await this?.app?.close();
      });
    });
  };
}

export default GraphQLFastify;
