import { DocumentNode, ExecutionResult, GraphQLSchema, parse, subscribe } from 'graphql';
import { FastifyInstanceGraphQL } from 'types/server';
import { PubSubType, WebSocketMessage, WebSocketType } from 'types/subcriptions';
import WebSocket, { RawData } from 'ws';

export const subscriptionConnection = (
  socket: WebSocket,
  app?: FastifyInstanceGraphQL,
  pubSub?: PubSubType
): { close: () => void } => {
  const { schema = '' } = app?.graphql || {};
  const test = new Map();

  socket.on('message', (message) => handleMessage(message));

  const handleMessage = async (message: RawData): Promise<void> => {
    const { type, payload, id } = JSON.parse(message.toString()) as WebSocketMessage;

    switch (type) {
      case WebSocketType.CONNECTION_INIT:
        sendMessage({ type: WebSocketType.CONNECTION_ACK });
        break;

      case WebSocketType.COMPLETE:
        close();
        break;

      case WebSocketType.SUBSCRIBE:
        handleSubscription(payload, id);
        break;

      default:
        break;
    }
  };

  const handleSubscription = async (
    payload: WebSocketMessage['payload'],
    id?: string
  ): Promise<void> => {
    const { operationName, query, variables } = payload as {
      query: string | DocumentNode;
      variables?: Record<string, unknown>;
      operationName?: string;
    };

    const document = typeof query === 'string' ? parse(query) : query;

    const result = await subscribe({
      schema: schema as GraphQLSchema,
      document,
      contextValue: Object.assign({}, { pubsub: pubSub }),
      variableValues: variables,
      operationName,
    });

    const { errors } = result as ExecutionResult;

    if (errors) {
      throw errors;
    }

    test.set(id, pubSub);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for await (const value of result as AsyncGenerator<Record<string, any>>) {
      sendMessage({ id, type: WebSocketType.NEXT, payload: value });
    }

    sendMessage({ type: WebSocketType.COMPLETE, id });
    test.get(id)?.close?.();

    test.delete(id);
  };

  const sendMessage = (message: WebSocketMessage): void => {
    socket.send(JSON.stringify(message));
  };

  const close = (): void => {
    socket.close();
  };

  return { close };
};
