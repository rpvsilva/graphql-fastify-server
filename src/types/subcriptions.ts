import { PubSub } from 'subscriptions/pubsub';

export enum WebSocketType {
  CONNECTION_INIT = 'connection_init',
  CONNECTION_ACK = 'connection_ack',
  COMPLETE = 'complete',
  SUBSCRIBE = 'subscribe',
  NEXT = 'next',
  DATA = 'data',
}

export type WebSocketMessage = {
  id?: string;
  type: WebSocketType;
  payload?: Record<string, unknown>;
};

export type PubSubType = ReturnType<typeof PubSub>;
