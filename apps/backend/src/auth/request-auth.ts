import { Request } from 'express';
import { AuthIdentity } from '../database/game-data-store';

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function getRequestAuthIdentity(request: Request): AuthIdentity {
  const authProvider = firstHeaderValue(request.headers['x-newtrip-auth-provider']) ?? 'anonymous';
  const externalId = firstHeaderValue(request.headers['x-newtrip-auth-id']) ?? 'dev-player';
  const displayName = firstHeaderValue(request.headers['x-newtrip-display-name']);
  const timezone = firstHeaderValue(request.headers['x-newtrip-timezone']) ?? 'UTC';

  return {
    authProvider,
    externalId,
    displayName,
    timezone,
  };
}
