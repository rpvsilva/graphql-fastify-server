import { DefinitionNode, DocumentNode, OperationDefinitionNode, SelectionNode } from 'graphql';
import { CachePolicy } from '../types/cache';
import { ObjectOfAny } from '../types/misc';
import { hashString } from './string';

type CacheInformation = {
  ttl: number;
  isPrivate: boolean;
};

const defaultQueryFields = ['__typename', '__schema', '__type'];

export const isIntrospectionQuery = (operationName?: string): boolean => {
  return operationName === 'IntrospectionQuery';
};

/**
 * @returns It returns the ttl of the cache. If it's 0 then the query it's not cacheable
 */
export const getCacheTtl = (
  query: DocumentNode,
  cachePolicy?: CachePolicy,
  operationName?: string
): CacheInformation | null => {
  if (!cachePolicy) return null;
  const {
    selectionSet: { selections },
  } = getOperation(query.definitions, operationName);

  const { cacheTtls, isPrivate } = getCacheableTtls(selections, cachePolicy);

  if (selections.length !== cacheTtls.length) return null;

  return {
    ttl: Math.max(...cacheTtls),
    isPrivate,
  };
};

const getCacheableTtls = (selections: readonly SelectionNode[], cachePolicy: CachePolicy) => {
  return selections.reduce(
    (acc, selection) => {
      if (selection.kind !== 'Field' || defaultQueryFields.includes(selection.name.value)) {
        return acc;
      }

      const name = selection.name.value;
      const cacheRule = cachePolicy[name];

      if (!cacheRule) return acc;

      acc.cacheTtls.push(cacheRule.ttl);

      if (!acc.isPrivate) acc.isPrivate = cacheRule.scope === 'PRIVATE';

      return acc;
    },
    { cacheTtls: [], isPrivate: false } as { cacheTtls: number[]; isPrivate: boolean }
  );
};

export const getOperation = (
  definitions: readonly DefinitionNode[],
  operationName?: string
): OperationDefinitionNode => {
  if (!operationName) return definitions[0] as OperationDefinitionNode;

  return definitions.find(
    (def) => def.kind === 'OperationDefinition' && def.name?.value === operationName
  ) as OperationDefinitionNode;
};

export const generateCacheKey = (
  query: string,
  authorizationToken = '',
  variables: ObjectOfAny = {},
  operationName = '',
  extraCacheKeyData = ''
): string => {
  const string = `${operationName}${query}${JSON.stringify(
    variables
  )}${authorizationToken}${extraCacheKeyData}`;

  return `gfc:${hashString(string)}`;
};
