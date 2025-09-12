import { type CommonLogger, globalLogger } from '@lokalise/node-core'
import type { AwilixContainer, Resolver } from 'awilix'
import { Lifetime } from 'awilix'
import type { AppInstance } from '../app.js'
import type { UsersModuleDependencies } from '../modules/users/diConfig.ts'
import { resolveUsersConfig } from '../modules/users/diConfig.ts'
import type { CommonDependencies } from './commonDiConfig.ts'
import { resolveCommonDiConfig } from './commonDiConfig.ts'

export type ExternalDependencies = {
  app?: AppInstance
  logger: CommonLogger
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

// biome-ignore lint/suspicious/noExplicitAny: We neither know, nor care about the type here
type DiConfig = Record<keyof Dependencies, Resolver<any>>

export type Dependencies = CommonDependencies & UsersModuleDependencies

declare module '@fastify/awilix' {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface Cradle extends Dependencies {}

  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface RequestCradle extends Dependencies {}
}
