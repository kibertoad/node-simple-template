import type { Resolver } from 'awilix'
import { asClass } from 'awilix'

import type { CommonDependencies } from '../../infrastructure/commonDiConfig'
import { SINGLETON_CONFIG } from '../../infrastructure/diConfig'

import { UserRepository } from './repositories/UserRepository'
import { PermissionsService } from './services/PermissionsService'
import { UserService } from './services/UserService'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UsersDiConfig = Record<keyof UsersModuleDependencies, Resolver<any>>

export type UsersModuleDependencies = {
  userRepository: UserRepository
  userService: UserService

  permissionsService: PermissionsService
}

export type UsersInjectableDependencies = UsersModuleDependencies & CommonDependencies

export type UsersPublicDependencies = Pick<
  UsersInjectableDependencies,
  'userService' | 'permissionsService'
>

export function resolveUsersConfig(): UsersDiConfig {
  return {
    userRepository: asClass(UserRepository, SINGLETON_CONFIG),
    userService: asClass(UserService, SINGLETON_CONFIG),

    permissionsService: asClass(PermissionsService, SINGLETON_CONFIG),
  }
}
