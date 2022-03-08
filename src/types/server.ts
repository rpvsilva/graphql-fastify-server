/* eslint-disable @typescript-eslint/no-explicit-any */
import { FastifyRequest } from 'fastify';
import { GraphQLSchema } from 'graphql';
import { RenderPageOptions } from 'graphql-playground-html';
import { ObjectOfAny } from '../types/misc';
import { Cache } from './cache';
import { Middlewares } from './middlewares';

export type GraphQLFastifyConfig<R = any> = {
  schema: GraphQLSchema;
  debug?: boolean;
  playground?: PlaygroundOptions;
  context?: (request: FastifyRequest) => ObjectOfAny;
  cache?: Cache<R>;
  middlewares?: Middlewares;
};

export type PlaygroundOptions = RenderPageOptions & {
  enabled?: boolean;
  endpoint?: string;
  introspection?: boolean;
};

export type GraphQLBody = {
  query: string;
  operationName?: string;
  variables?: ObjectOfAny;
};
