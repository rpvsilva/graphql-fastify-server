import { ExecutionResult, GraphQLSchema, parse, subscribe } from 'graphql';
import { FastifyInstanceGraphQL, GraphQLBody } from 'types/server';
import { PubSubType, WebSocketMessage, WebSocketType } from 'types/subcriptions';
import WebSocket, { RawData } from 'ws';
import { subContext } from './pubsub';

export const subscriptionConnection = (
  socket: WebSocket,
  context?: Record<string, unknown>,
  app?: FastifyInstanceGraphQL,
  pubSub?: PubSubType,
): { close: () => void } => {
  const { schema = '' } = app?.graphql || {};

  socket.on('message', (message) => handleMessage(message));

  const handleMessage = async (message: RawData): Promise<void> => {
    const { type, payload, id } = JSON.parse(message.toString()) as WebSocketMessage;

    switch (type) {
      case WebSocketType.CONNECTION_INIT:
        return sendMessage({ type: WebSocketType.CONNECTION_ACK });

      case WebSocketType.COMPLETE:
        return close();

      case WebSocketType.SUBSCRIBE:
        return handleSubscription(payload, id);

      default:
        break;
    }
  };

  const handleSubscription = async (
    payload: WebSocketMessage['payload'],
    id?: string,
  ): Promise<void> => {
    if (!pubSub) return;

    const { operationName, query, variables } = payload as GraphQLBody;

    const result = await subscribe({
      schema: schema as GraphQLSchema,
      document: parse(query),
      contextValue: Object.assign(context || {}, { pubsub: subContext({ pubsub: pubSub }) }),
      variableValues: variables,
      operationName,
    });

    const { errors } = result as ExecutionResult;

    if (errors) {
      throw errors;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for await (const value of result as AsyncGenerator<Record<string, any>>) {
      sendMessage({ id, type: WebSocketType.NEXT, payload: value });
    }

    sendMessage({ id, type: WebSocketType.COMPLETE });
  };

  const sendMessage = (message: WebSocketMessage): void => {
    socket.send(JSON.stringify(message));
  };

  const close = (): void => {
    socket.close();
  };

  return { close };
};
