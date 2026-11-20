// Node stand-in for the workerd-only `cloudflare:*` modules so tests can import the Worker entry.
class Base {
  constructor(..._args: unknown[]) {}
}

export class DurableObject extends Base {}
export class RpcTarget extends Base {}
export class WorkerEntrypoint extends Base {}
export class WorkflowEntrypoint extends Base {}
export class WorkflowEvent extends Base {}
export class EmailMessage extends Base {}
export const env = {};
export const exports = {};
