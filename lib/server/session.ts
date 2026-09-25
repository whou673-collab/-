import 'server-only'
import { auth } from '@/lib/auth'
import type { StudioStatus } from '@/lib/studio'
import { AppError } from './errors'
import { assertSameOrigin } from './origin'

export async function requireUser(request: Request) {
  if (!['GET', 'HEAD'].includes(request.method)) assertSameOrigin(request)
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user) throw new AppError('请先登录，再使用你的私密创作空间。', 401)
  return session.user.id
}

export async function getStudioStatus(requestHeaders: Headers): Promise<StudioStatus> {
  const database = Boolean(process.env.DATABASE_URL)
  const storage = Boolean(process.env.BLOB_READ_WRITE_TOKEN)
  const security = (process.env.BETTER_AUTH_SECRET?.length ?? 0) >= 32
    && (process.env.API_KEY_ENCRYPTION_SECRET?.length ?? 0) >= 32
  const session = database && security
    ? await auth.api.getSession({ headers: requestHeaders })
    : null
  return {
    ready: database && storage && security,
    database,
    storage,
    security,
    user: session?.user ? { id: session.user.id, name: session.user.name, email: session.user.email } : null,
  }
}
