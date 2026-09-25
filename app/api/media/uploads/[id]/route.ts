import { completeReference, discardPendingReference } from '@/lib/server/media'
import { errorResponse, json } from '@/lib/server/errors'
import { requireUser } from '@/lib/server/session'
import { idSchema } from '@/lib/server/validation'

export const runtime = 'nodejs'
export const maxDuration = 60

type Context = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: Context) {
  try {
    const userId = await requireUser(request)
    const id = idSchema.parse((await context.params).id)
    return json({ asset: await completeReference(userId, id) })
  } catch (error) { return errorResponse(error) }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const userId = await requireUser(request)
    const id = idSchema.parse((await context.params).id)
    await discardPendingReference(userId, id)
    return json({ success: true })
  } catch (error) { return errorResponse(error) }
}
