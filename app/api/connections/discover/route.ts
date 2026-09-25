import { errorResponse, json } from '@/lib/server/errors'
import { discoverModels } from '@/lib/server/models'
import { requireUser } from '@/lib/server/session'
import { discoverySchema, readJson } from '@/lib/server/validation'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request) {
  try {
    await requireUser(request)
    const input = discoverySchema.parse(await readJson(request))
    return json(await discoverModels(input.baseUrl, input.apiKey))
  } catch (error) { return errorResponse(error) }
}
