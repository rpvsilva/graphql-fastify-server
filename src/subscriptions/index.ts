import { SocketStream } from '@fastify/websocket';
import { subscriptionConnection } from './connection';
import { FastifyInstanceGraphQL } from 'types/server';
import { PubSubType } from 'types/subcriptions';

export const handleSubscriptions = (
  connection: SocketStream,
  context?: Record<string, unknown>,
  app?: FastifyInstanceGraphQL,
  pubSub?: PubSubType,
): void => {
  const { socket } = connection;

  const subConnection = subscriptionConnection(socket, context, app, pubSub);

  socket.on('close', () => subConnection.close());
  socket.on('error', () => subConnection.close());
};
