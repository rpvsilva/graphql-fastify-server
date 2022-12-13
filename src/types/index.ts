export { Cache, CachePolicy } from './cache';

export { GraphQLBody, GraphQLFastifyConfig } from './server';

export { Middlewares } from './middlewares';
import GraphQLFastify from '../server';

export type PubSub = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  publish: (topic: string, payload: Record<string, any>) => Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  subscribe: (topic: string) => Promise<AsyncIterableIterator<Record<string, any>>>;
};

export default GraphQLFastify;
