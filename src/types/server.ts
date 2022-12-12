/* eslint-disable @typescript-eslint/no-explicit-any */
import { FastifyInstance, FastifyRequest } from 'fastify';
import { GraphQLSchema } from 'graphql';
import { ObjectOfAny } from '../types/misc';
import { Cache } from './cache';
import { Middlewares } from './middlewares';
import { TypeSource } from '@graphql-tools/utils';

export type GraphQLFastifyConfig<R = any> = SchemaConfig & {
  debug?: boolean;
  playground?: PlaygroundOptions;
  context?: (request: FastifyRequest) => ObjectOfAny;
  cache?: Cache<R>;
  middlewares?: Middlewares;
  subscriptions?: boolean;
};

type SchemaConfig =
  | {
      schema: GraphQLSchema;
    }
  | {
      typeDefs: TypeSource;
      resolvers: ObjectOfAny;
    };

export type PlaygroundOptions = {
  enabled?: boolean;
  endpoint?: string;
  introspection?: boolean;
};

export type GraphQLBody = {
  query: string;
  operationName?: string;
  variables?: ObjectOfAny;
};

export const isSchemaType = (config: ObjectOfAny): config is { schema: GraphQLSchema } =>
  !!config.schema;

export type FastifyInstanceGraphQL = FastifyInstance & { graphql: { schema: GraphQLSchema } };
