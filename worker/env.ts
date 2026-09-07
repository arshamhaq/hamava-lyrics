// Small interfaces for the bindings this Worker actually uses.
export interface Statement {
  bind(...values: unknown[]): Statement
  first<T>(): Promise<T | null>
  run(): Promise<unknown>
}
export interface Env {
  DB: { prepare(sql: string): Statement }
  AI: { run(model: string, input: Record<string, unknown>): Promise<unknown> }
  ASSETS: { fetch(request: Request): Promise<Response> }
  TEST_ACCESS_KEY?: string
}
