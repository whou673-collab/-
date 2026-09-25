import { AppError } from './errors'

export function applicationOrigins(env: NodeJS.ProcessEnv = process.env) {
  const canonical = env.BETTER_AUTH_URL
    ?? (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined)
    ?? (env.VERCEL_URL ? `https://${env.VERCEL_URL}` : undefined)
    ?? (env.NODE_ENV === 'development' ? env.V0_RUNTIME_URL : undefined)
  const candidates = [
    canonical,
    ...(env.NODE_ENV === 'development' ? [
      'http://localhost:3000', env.V0_RUNTIME_URL, env.V0_DEV_APP_URL, env.V0_BUILD_URL, env.V0_SANDBOX_URL,
    ] : []),
    ...(env.NODE_ENV === 'production' ? [
      env.VERCEL_URL ? `https://${env.VERCEL_URL}` : undefined,
      env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined,
    ] : []),
  ]
  return new Set(candidates.flatMap((value) => {
    if (!value) return []
    try { return [new URL(value).origin] } catch { return [] }
  }))
}

export function assertSameOrigin(request: Request, allowed = applicationOrigins()) {
  const origin = request.headers.get('origin')
  if (!origin || origin === 'null' || !allowed.has(origin)) {
    throw new AppError('请求来源不受信任，请刷新页面后重试。', 403)
  }
}
