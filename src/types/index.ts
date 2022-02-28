/* eslint-disable @typescript-eslint/no-explicit-any */
import { FastifyRequest } from 'fastify';
import { GraphQLSchema } from 'graphql';
import { RenderPageOptions } from 'graphql-playground-html';
import { ObjectOfAny } from 'types/misc';
import { Cache } from './cache';

export type GraphQLFastifyConfig<C = Record<string, never>> = {
  schema: GraphQLSchema;
  debug?: boolean;
  playground?: PlaygroundOptions;
  context?: (request: FastifyRequest) => ObjectOfAny;
  cache?: Cache<C>;
};

type PlaygroundOptions = RenderPageOptions & {
  enabled?: boolean;
  endpoint?: string;
  introspection?: boolean;
};

export type GraphQLBody = {
  query: string;
  operationName?: string;
  variables?: { [key: string]: ObjectOfAny };
};
