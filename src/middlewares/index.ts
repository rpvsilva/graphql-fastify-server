import {
  FastifyReply,
  FastifyRequest,
  HookHandlerDoneFunction,
  RouteShorthandOptions,
} from 'fastify';
import { GraphQLBody, GraphQLFastifyConfig } from '../types';
import { isIntrospectionQuery } from '../utils/cache';

export const disableIntrospection = (
  request: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction,
  playground: GraphQLFastifyConfig['playground'] = {},
): FastifyReply | void => {
  const { operationName } = request.body as GraphQLBody;
  const { introspection = true } = playground;

  if (!introspection && isIntrospectionQuery(operationName)) {
    return reply.code(400).send(Error('IntrospectionQuery is disabled on GraphQLFastifyServer.'));
  }

  return done();
};

export const postMiddleware = (config: GraphQLFastifyConfig): RouteShorthandOptions => {
  return {
    preHandler: (...args) => disableIntrospection(...args, config.playground),
  };
};
