import { errorResponse, json } from '@/lib/server/errors'
import { reserveReference } from '@/lib/server/media'
import { requireUser } from '@/lib/server/session'
import { readJson, uploadSchema } from '@/lib/server/validation'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const userId = await requireUser(request)
    const input = uploadSchema.parse(await readJson(request))
    return json(await reserveReference(userId, input), 201)
  } catch (error) { return errorResponse(error) }
}
