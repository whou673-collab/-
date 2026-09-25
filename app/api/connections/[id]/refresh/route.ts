import { refreshModels } from '@/lib/server/connections'
import { errorResponse, json } from '@/lib/server/errors'
import { requireUser } from '@/lib/server/session'
import { idSchema } from '@/lib/server/validation'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUser(request)
    const id = idSchema.parse((await context.params).id)
    return json(await refreshModels(userId, id))
  } catch (error) { return errorResponse(error) }
}
