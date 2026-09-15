export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> }
}
