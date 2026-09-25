import { sql } from 'drizzle-orm'
import { pgTable, text, timestamp, boolean, uuid, integer, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core'
import type { Generation, ImageSize, ModelInfo } from '@/lib/studio'

// --- Better Auth required tables -------------------------------------------
// Column names are camelCase to match Better Auth's defaults. Do not rename.

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt'),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt').defaultNow(),
  updatedAt: timestamp('updatedAt').defaultNow(),
})

// --- App tables ------------------------------------------------------------
// Add your app tables below. Always include a plain `userId` column so queries
// can be scoped per user — the security model depends on this column existing,
// not on a foreign key. Do NOT add a foreign key constraint
// (`.references(() => user.id, ...)`) unless the user explicitly asks for
// foreign keys or referential integrity; FK constraints make iterating on the
// schema harder.
//
// Example:
//
// import { serial } from "drizzle-orm/pg-core"
//
// export const todos = pgTable("todos", {
//   id: serial("id").primaryKey(),
//   userId: text("userId").notNull(),
//   title: text("title").notNull(),
//   completed: boolean("completed").notNull().default(false),
//   createdAt: timestamp("createdAt").notNull().defaultNow(),
// })
//
// If the user asks for foreign keys, add the reference back in:
//   userId: text("userId")
//     .notNull()
//     .references(() => user.id, { onDelete: "cascade" }),

export const connections = pgTable('studio_connections', {
  id: uuid('id').primaryKey(),
  userId: text('userId').notNull(),
  name: text('name').notNull(),
  baseUrl: text('baseUrl').notNull(),
  encryptedKey: text('encryptedKey').notNull(),
  keyHint: text('keyHint').notNull(),
  models: jsonb('models').$type<ModelInfo[]>().notNull().default([]),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
})

export const assets = pgTable('studio_assets', {
  id: uuid('id').primaryKey(),
  userId: text('userId').notNull(),
  kind: text('kind').$type<'reference' | 'output'>().notNull(),
  pathname: text('pathname').notNull().unique(),
  name: text('name').notNull(),
  mediaType: text('mediaType').notNull(),
  width: integer('width').notNull().default(0),
  height: integer('height').notNull().default(0),
  size: integer('size').notNull().default(0),
  ready: boolean('ready').notNull().default(false),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index('studio_assets_user_created').on(table.userId, table.createdAt.desc())])

export const generations = pgTable('studio_generations', {
  id: uuid('id').primaryKey(),
  userId: text('userId').notNull(),
  connectionId: uuid('connectionId').notNull(),
  model: text('model').notNull(),
  prompt: text('prompt').notNull(),
  negativePrompt: text('negativePrompt').notNull().default(''),
  size: text('size').$type<ImageSize>().notNull(),
  count: integer('count').notNull(),
  status: text('status').$type<Generation['status']>().notNull().default('queued'),
  favorite: boolean('favorite').notNull().default(false),
  referenceIds: uuid('referenceIds').array().notNull().default([]),
  outputIds: uuid('outputIds').array().notNull().default([]),
  requestId: uuid('requestId').notNull(),
  requestHash: text('requestHash').notNull(),
  runId: text('runId'),
  error: text('error'),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('studio_generations_userId_requestId_key').on(table.userId, table.requestId),
  index('studio_generations_user_created').on(table.userId, table.createdAt.desc()),
])
