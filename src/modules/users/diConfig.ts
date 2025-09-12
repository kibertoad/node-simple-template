import type { User } from '@prisma/client'
import type { Resolver } from 'awilix'
import { asClass, asFunction, Lifetime } from 'awilix'
import type { InMemoryCacheConfiguration, LoaderConfig } from 'layered-loader'
import { Loader } from 'layered-loader'

import type { CommonDependencies } from '../../infrastructure/commonDiConfig.ts'
import type { DIOptions } from '../../infrastructure/diConfig.ts'
import { SINGLETON_CONFIG } from '../../infrastructure/diConfig.ts'

import { UserDataSource } from './datasources/UserDataSource.ts'
import { UserRepository } from './repositories/UserRepository.ts'
import { PermissionsService } from './services/PermissionsService.ts'
import { UserService } from './services/UserService.ts'

const IN_MEMORY_CACHE_TTL = 1000 * 60 * 5
const IN_MEMORY_TTL_BEFORE_REFRESH = 1000 * 25

const IN_MEMORY_CONFIGURATION_BASE: InMemoryCacheConfiguration = {
  ttlInMsecs: IN_MEMORY_CACHE_TTL,
  ttlLeftBeforeRefreshInMsecs: IN_MEMORY_TTL_BEFORE_REFRESH,
  cacheType: 'fifo-object',
}

// biome-ignore lint/suspicious/noExplicitAny: We neither know, nor care about the type here
type UsersDiConfig = Record<keyof UsersModuleDependencies, Resolver<any>>

export type UsersModuleDependencies = {
  userRepository: UserRepository
  userService: UserService
  userLoader: Loader<User>

  permissionsService: PermissionsService
}

export type UsersInjectableDependencies = UsersModuleDependencies & CommonDependencies

export type UsersPublicDependencies = Pick<
  UsersInjectableDependencies,
  'userService' | 'permissionsService'
>

export function resolveUsersConfig(_options: DIOptions): UsersDiConfig {
  return {
    userRepository: asClass(UserRepository, SINGLETON_CONFIG),
    userService: asClass(UserService, SINGLETON_CONFIG),

    userLoader: asFunction(
      (deps: UsersInjectableDependencies) => {
        const config: LoaderConfig<User> = {
          inMemoryCache: {
            ...IN_MEMORY_CONFIGURATION_BASE,
            maxItems: 1000,
          },
          dataSources: [new UserDataSource(deps)],
          logger: deps.logger,
        }
        return new Loader(config)
      },
      {
        lifetime: Lifetime.SINGLETON,
      },
    ),

    permissionsService: asClass(PermissionsService, SINGLETON_CONFIG),
  }
}
