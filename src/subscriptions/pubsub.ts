/* eslint-disable @typescript-eslint/no-explicit-any */
import mqemitter, { Message } from 'mqemitter';
import { Readable } from 'readable-stream';

const PubSub = () => {
  const emitter = mqemitter();

  const subscribe = (topic: string, queue: Readable & { close?: () => void }): Promise<null> => {
    return new Promise((resolve) => {
      function listener(value: Message, cb: () => void) {
        queue.push(value.payload);
        cb();
      }

      emitter.on(topic, listener, () => {
        resolve(null);
      });

      queue.close = () => {
        console.log('remove');
        emitter.removeListener(topic, listener);
      };
    });
  };

  const publish = (event: Message, callback?: (err?: Error) => void): void => {
    emitter.emit(event, callback);
  };

  return { subscribe, publish };
};

export const usePubSub = () => {
  const pubsub = PubSub();
  const queue: Readable & { close?: () => void } = new Readable({
    objectMode: true,
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    read: () => {},
  });

  const subscribe = (topic: string) => {
    return pubsub.subscribe(topic, queue).then(() => queue);
  };

  const publish = (event: Message) => {
    return new Promise((resolve, reject) => {
      pubsub.publish(event, (err) => {
        if (err) return reject(err);

        resolve(null);
      });
    });
  };

  const close = () => {
    if (queue.close) {
      queue.close();
    }
  };

  return { subscribe, publish, close };
};
