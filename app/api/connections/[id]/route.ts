import { deleteConnection } from '@/lib/server/connections'
import { errorResponse, json } from '@/lib/server/errors'
import { requireUser } from '@/lib/server/session'
import { idSchema } from '@/lib/server/validation'

export const runtime = 'nodejs'

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUser(request)
    const id = idSchema.parse((await context.params).id)
    await deleteConnection(userId, id)
    return json({ success: true })
  } catch (error) { return errorResponse(error) }
}
