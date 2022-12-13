// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./types/globals.d.ts" />

import { LRU, lru } from 'tiny-lru';
import { FastifyInstanceGraphQL, GraphQLBody, GraphQLFastifyConfig } from './types/server';
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
import { handleSubscriptions } from 'subscriptions';
import fastifyWebsocket from '@fastify/websocket';
import { PubSub, subContext } from 'subscriptions/pubsub';

const REPLACE_PLAYGROUND_ENDPOINT = '<PLAYGROUND_ENDPOINT>';

class GraphQLFastify {
  private app: FastifyInstanceGraphQL | undefined;
  private queriesCache: LRU<CompiledQuery>;
  private config: GraphQLFastifyConfig;
  private cache: GraphqlFastifyCache | undefined;
  private schema: GraphQLSchema;
  private graphiQLPlayground: string;
  private pubSub: ReturnType<typeof PubSub> | undefined;

  constructor(config: GraphQLFastifyConfig) {
    this.config = config;
    this.queriesCache = lru(1024);
    this.schema = getSchema(config);

    if (config.cache) {
      this.cache = cache(config.cache);
    }

    if (config.subscriptions) {
      this.pubSub = PubSub();
    }

    const replaceRegex = new RegExp(REPLACE_PLAYGROUND_ENDPOINT, 'g');

    this.graphiQLPlayground = playgroundHTML.replace(
      replaceRegex,
      config.playground?.endpoint || '/'
    );
  }

  public applyMiddleware = async (config: { app: FastifyInstance; path: '/' }): Promise<void> => {
    const { app, path } = config;

    this.app = Object.assign(app, { graphql: { schema: this.schema } });

    if (app.websocketServer === undefined) {
      await this.app.register(fastifyWebsocket, {
        options: { maxPayload: 1048576 },
      });
    }

    this.enableGraphQLRequests(path);

    this.configPlayground();

    this.enableLivenessReadiness();

    this.handleServerShutdown();
  };

  private getCacheKey = ({
    query,
    operationName,
    variables,
    authorization,
    extraCacheKeyData,
  }: GetCacheKey): string => {
    if (!this.cache) return '';

    return generateCacheKey(query, authorization, variables, operationName, extraCacheKeyData);
  };

  private enableGraphQLRequests = (path = '/') => {
    const { cache, context } = this.config;

    this.app?.post(path, postMiddleware(this.config), async (request) => {
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
        operationName,
        authorization: isPrivate ? headers.authorization : '',
        extraCacheKeyData: cache?.extraCacheKeyData?.(context),
      });

      if (this.cache && !isIntroQuery) {
        const cachedValue = await this.cache.get(cacheKey);

        if (cachedValue) return cachedValue;
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

      const executionResult = await compiledQuery.query(
        {},
        Object.assign(ctx, { pubsub: this.pubSub && subContext({ pubsub: this.pubSub }) }),
        variables
      );
      const hasErrors = executionResult.errors?.length;

      if (this.cache && !isIntroQuery && ttl && !hasErrors && executionResult.data) {
        this.cache.set(cacheKey, JSON.stringify(executionResult), ttl);
      }

      return executionResult;
    });
  };

  private configPlayground = () => {
    const { subscriptions, playground } = this.config;
    const { enabled = true, endpoint = '/' } = playground || {};

    if (!enabled) return;

    this.app?.route({
      url: endpoint,
      method: 'GET',
      handler: (_, reply) => {
        return reply
          .headers({
            'Content-Type': 'text/html',
          })
          .send(this.graphiQLPlayground);
      },
      wsHandler: (conn, req) => {
        return !subscriptions
          ? undefined
          : handleSubscriptions(conn, this.config.context?.(req), this.app, this.pubSub);
      },
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
    this.app?.get('/server-health', () => ({ status: 'ok' }));
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
