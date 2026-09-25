import { deleteGeneration, favoriteGeneration } from '@/lib/server/generations'
import { errorResponse, json } from '@/lib/server/errors'
import { requireUser } from '@/lib/server/session'
import { favoriteSchema, idSchema, readJson } from '@/lib/server/validation'

export const runtime = 'nodejs'
export const maxDuration = 60

type Context = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, context: Context) {
  try {
    const userId = await requireUser(request)
    const id = idSchema.parse((await context.params).id)
    const input = favoriteSchema.parse(await readJson(request))
    await favoriteGeneration(userId, id, input.favorite)
    return json({ success: true })
  } catch (error) { return errorResponse(error) }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const userId = await requireUser(request)
    const id = idSchema.parse((await context.params).id)
    await deleteGeneration(userId, id)
    return json({ success: true })
  } catch (error) { return errorResponse(error) }
}
