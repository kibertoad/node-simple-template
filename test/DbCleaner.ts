import type { PrismaClient } from '@prisma/client'

export const DB_MODEL = {
  User: 'user',
} as const

type DbModel = (typeof DB_MODEL)[keyof typeof DB_MODEL]

export async function cleanTables(prisma: PrismaClient, modelNames: readonly DbModel[]) {
  const delegates = modelNames.map<{ deleteMany: () => Promise<unknown> }>(
    (modelName) => prisma[modelName],
  )

  for (const delegate of delegates) {
    await delegate.deleteMany()
  }
}
