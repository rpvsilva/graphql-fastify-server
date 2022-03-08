# GraphQL Fastify Server

![build badge](https://github.com/rpvsilva/graphql-fastify-server/actions/workflows/ci.yml/badge.svg) 
[<img src="https://img.shields.io/npm/dt/graphql-fastify-server?color=brightgreen&logo=npm">](https://npmjs.com/package/graphql-fastify-server)
![version](https://img.shields.io/npm/v/graphql-fastify-server?color=brightgreen&label=version)
[<img src="https://snyk.io/test/github/rpvsilva/graphql-fastify-server/badge.svg">](https://snyk.io/test/github/rpvsilva/graphql-fastify-server)
![license](https://img.shields.io/github/license/rpvsilva/graphql-fastify-server?color=blue&logo=github)

- [Installation](#installation)
- [Usage](#usage)
  - [Using cache](#using-cache)
  - [Middlewares](#middlewares)
- [Liveness & Readiness](#liveness--readiness)
- [Contributing](#contributing)
- [License](#license)


## Installation

```shell
npm install --save graphql-fastify-server
```

## Usage

```javascript
const app = fastify();

const server = new GraphQLFastify({
  schema,
  context,
  debug: !isProd,
  playground: {
    introspection: !isProd,
  },
});

server.applyMiddleware({ app, path: '/' });
```

### Using cache
On GraphQL Fastify Server you can use two types of cache, one is memory cache and the other is using a Redis instance. Then you inject the cache variable into the GraphQLFastify instance.

```javascript
const cache: Cache<ContextType, Resolvers> = {
  defaultTTL: 1000,
  storage: 'memory',
  policy: {
    add: {
      ttl: 1000,
    },
  },
  extraCacheKeyData: (ctx) => {
    const { locale } = ctx;

    return locale;
  },
};

// --- OR ---

const cache: Cache<ContextType, Resolvers> = {
  defaultTTL: 1000,
  storage: new Redis({
    host: 'localhost',
    port: 6379,
  }),
  policy: {
    add: {
      ttl: 1000,
    },
  },
  extraCacheKeyData: (ctx) => {
    const { locale } = ctx;

    return locale;
  },
};
```

Also, you can define the query scope between `PUBLIC` and `PRIVATE` for caching. This tells the cache to use the authorization token from the headers to compute the cache key.

```javascript
const policy: CachePolicy<Resolvers> = {
  add: {
    ttl: 1000,
    scope: 'PUBLIC',
  },
  sub: {
    ttl: 1500,
    scope: 'PRIVATE',
  }
}
```

### Middlewares

You can use middlewares at the Fastify and you can define in which operations you want to execute them.

```javascript
const middlewares: Middlewares<ContextType, Resolvers> = [
  {
    handler: (context) => {
      const { isAutheticated } = context;

      if (!isAutheticated) throw new HttpError(401, 'Not authenticated');
    },
    operations: ['add'],
  },
];
```

## Liveness & Readiness

To check the health of the server you can make a GET request to the endpoint `/server-health`

## Contributing
If you have any doubt or to point out an issue just go ahead and create a new [issue](https://github.com/rpvsilva/graphql-fastify-server/issues/new). If you want to contribute, just [check](./CONTRIBUTING.md) how. 

## License
[MIT](./LICENSE)