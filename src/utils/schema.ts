import { makeExecutableSchema } from '@graphql-tools/schema';
import { GraphQLSchema } from 'graphql';
import { GraphQLFastifyConfig } from 'types';
import { isSchemaType } from 'types/server';

export const getSchema = (config: GraphQLFastifyConfig): GraphQLSchema => {
  if (isSchemaType(config)) return config.schema;

  const { resolvers, typeDefs } = config;

  return makeExecutableSchema({
    typeDefs,
    resolvers,
  });
};
