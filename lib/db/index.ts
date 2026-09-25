import 'server-only'
import { Pool } from 'pg'
import { sql } from 'drizzle-orm'
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import * as schema from './schema'
import { AppError } from '@/lib/server/errors'

type Database = NodePgDatabase<typeof schema>
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0]
export async function lockUser(transaction: Transaction, userId: string) {
  await transaction.execute(sql`select pg_advisory_xact_lock(hashtext(${`studio:${userId}`}))`)
}
const cache = globalThis as unknown as { studioDatabase?: Database; studioPool?: Pool }

export const pool = cache.studioPool ?? new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
})

if (!cache.studioPool) {
  pool.on('error', () => console.error('[studio] Database connection error'))
  cache.studioPool = pool
}

export function getDb(): Database {
  if (!process.env.DATABASE_URL) throw new AppError('数据库尚未配置，暂时无法保存内容。', 503)
  cache.studioDatabase ??= drizzle(pool, { schema })
  return cache.studioDatabase
}
