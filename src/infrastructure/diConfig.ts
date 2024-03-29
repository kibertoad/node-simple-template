import { globalLogger } from '@lokalise/node-core'
import type { AwilixContainer, Resolver } from 'awilix'
import { Lifetime } from 'awilix'
import type { FastifyInstance, FastifyBaseLogger } from 'fastify'

import type { UsersModuleDependencies } from '../modules/users/diConfig'
import { resolveUsersConfig } from '../modules/users/diConfig'

import type { CommonDependencies } from './commonDiConfig'
import { resolveCommonDiConfig } from './commonDiConfig'

export type ExternalDependencies = {
  app?: FastifyInstance
  logger: FastifyBaseLogger
}
export const SINGLETON_CONFIG = { lifetime: Lifetime.SINGLETON }

export type DependencyOverrides = Partial<DiConfig>

export type DIOptions = {
  jobsEnabled?: boolean
}

export function registerDependencies(
  diContainer: AwilixContainer,
  dependencies: ExternalDependencies = { logger: globalLogger },
  dependencyOverrides: DependencyOverrides = {},
  options: DIOptions = {},
): void {
  const areJobsEnabled = !!options.jobsEnabled

  const diConfig: DiConfig = {
    ...resolveCommonDiConfig(dependencies),
    ...resolveUsersConfig({
      jobsEnabled: areJobsEnabled,
    }),
  }
  diContainer.register(diConfig)

  for (const [dependencyKey, dependencyValue] of Object.entries(dependencyOverrides)) {
    diContainer.register(dependencyKey, dependencyValue)
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DiConfig = Record<keyof Dependencies, Resolver<any>>

export type Dependencies = CommonDependencies & UsersModuleDependencies

declare module '@fastify/awilix' {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface Cradle extends Dependencies {}

  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface RequestCradle extends Dependencies {}
}
