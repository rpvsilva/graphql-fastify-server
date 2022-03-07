/* eslint-disable @typescript-eslint/no-explicit-any */

export type Middlewares<Ctx = any, T = any> = MiddlewareItem<Ctx, T>[];

type MiddlewareItem<Ctx, T> = {
  handler: (context: Ctx) => void;
  operations: (keyof T)[];
};
