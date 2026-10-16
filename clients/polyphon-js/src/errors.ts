// AUTO-SYNCED from polyphon/src/sdk — do not edit by hand

import { RPC_ERROR } from './api.js';

export { RPC_ERROR };

export class RpcError extends Error {
  readonly code: number;
  readonly data?: unknown;

  constructor(code: number, message: string, data?: unknown) {
    super(message);
    this.name = 'RpcError';
    this.code = code;
    this.data = data;
  }
}
