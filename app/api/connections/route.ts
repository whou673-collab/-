import { createConnection, listConnections } from '@/lib/server/connections'
import { errorResponse, json } from '@/lib/server/errors'
import { requireUser } from '@/lib/server/session'
import { connectionSchema, readJson } from '@/lib/server/validation'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(request: Request) {
  try { return json({ connections: await listConnections(await requireUser(request)) }) }
  catch (error) { return errorResponse(error) }
}

export async function POST(request: Request) {
  try {
    const userId = await requireUser(request)
    const input = connectionSchema.parse(await readJson(request))
    return json(await createConnection(userId, input), 201)
  } catch (error) { return errorResponse(error) }
}
