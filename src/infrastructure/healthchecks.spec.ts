import type { PrismaClient } from '@prisma/client'
import { asFunction } from 'awilix'

import { type AppInstance, getApp } from '../app.ts'

import { dbHealthCheck } from './healthchecks.ts'

const createPrismaMock = (shouldSucceed: boolean) =>
  ({
    $queryRaw: () => {
      if (shouldSucceed) {
        return Promise.resolve([{ 1: 1n }])
      }
      throw new Error(
        "Can't reach database server at `test-service.server.test`:`1234`\n\nPlease make sure your database server is running at `test-service.server.test`:`1234`.",
      )
    },
  }) as Pick<PrismaClient, '$queryRaw'>

describe('healthcheck', () => {
  let app: AppInstance
  beforeEach(async () => {
    app = await getApp()
  })

  afterEach(async () => {
    await app.close()
  })

  describe('DB healthcheck', () => {
    it('Fails on unexpected DB response', async () => {
      app.diContainer.register(
        'prisma',
        asFunction(() => createPrismaMock(false)),
      )

      const result = await dbHealthCheck(app)
      expect(result.result).toBeUndefined()
      expect(result.error).toBeDefined()
    })

    it('Does not fail on successful DB ping', async () => {
      app.diContainer.register(
        'prisma',
        asFunction(() => createPrismaMock(true)),
      )

      const result = await dbHealthCheck(app)
      expect(result.result).toBeDefined()
      expect(result.error).toBeUndefined()
    })
  })
})
