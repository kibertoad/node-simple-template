import type { ErrorReporter } from '@lokalise/node-core'
import { globalLogger } from '@lokalise/node-core'
import { PrismaClient } from '@prisma/client'
import type { Resolver } from 'awilix'
import { asClass, asFunction, Lifetime } from 'awilix'
import type { FastifyBaseLogger } from 'fastify'
import type P from 'pino'
import { pino } from 'pino'

import { FakeStoreApiClient } from '../integrations/FakeStoreApiClient'

import { getConfig } from './config'
import type { Config } from './config'
import type { ExternalDependencies } from './diConfig'
import { SINGLETON_CONFIG } from './diConfig'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CommonDiConfig = Record<keyof CommonDependencies, Resolver<any>>

export function resolveCommonDiConfig(
  dependencies: ExternalDependencies = { logger: globalLogger },
): CommonDiConfig {
  return {
    logger: asFunction(() => dependencies.logger ?? pino(), SINGLETON_CONFIG),

    prisma: asFunction(
      ({ config }: CommonDependencies) => {
        return new PrismaClient({
          datasources: {
            db: {
              url: config.db.databaseUrl,
            },
          },
        })
      },
      {
        dispose: (prisma) => {
          return prisma.$disconnect()
        },
        lifetime: Lifetime.SINGLETON,
      },
    ),

    config: asFunction(() => {
      return getConfig()
    }, SINGLETON_CONFIG),

    errorReporter: asFunction(() => {
      return {
        report: (report) => console.error(report),
      } satisfies ErrorReporter
    }),
    fakeStoreApiClient: asClass(FakeStoreApiClient, SINGLETON_CONFIG),
  }
}

export type CommonDependencies = {
  config: Config
  logger: FastifyBaseLogger & P.Logger

  prisma: PrismaClient

  errorReporter: ErrorReporter

  fakeStoreApiClient: FakeStoreApiClient
}
