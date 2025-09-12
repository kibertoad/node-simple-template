import type { Cradle } from '@fastify/awilix'
import { NewRelicTransactionManager } from '@lokalise/fastify-extras'
import { globalLogger } from '@lokalise/node-core'
import type { AwilixContainer } from 'awilix'
import { asFunction, createContainer } from 'awilix'
import { merge } from 'ts-deepmerge'
import type { AppInstance } from '../src/app.js'
import type { Config } from '../src/infrastructure/config.ts'
import { getConfig } from '../src/infrastructure/config.ts'
import type { DependencyOverrides } from '../src/infrastructure/diConfig.ts'
import { registerDependencies, SINGLETON_CONFIG } from '../src/infrastructure/diConfig.ts'

type NestedPartial<T> = {
  [P in keyof T]?: NestedPartial<T[P]>
}

export type ConfigOverrides = NestedPartial<Config>

export type TestContext = {
  diContainer: AwilixContainer<Cradle>
}

export function createTestContext(
  dependencyOverrides: DependencyOverrides = {},
  configOverrides?: ConfigOverrides,
): TestContext {
  const diContainer = createContainer({
    injectionMode: 'PROXY',
  })

  const fakeApp: Partial<AppInstance> = {
    newrelicTransactionManager: NewRelicTransactionManager.createDisabled(),
  }

  const dependencies = configOverrides
    ? {
        ...dependencyOverrides,
        config: asFunction(() => {
          return merge(getConfig(), configOverrides)
        }, SINGLETON_CONFIG),
      }
    : dependencyOverrides

  registerDependencies(
    diContainer,
    {
      app: fakeApp as AppInstance,
      logger: globalLogger,
    },
    dependencies,
  )

  return {
    diContainer,
  }
}

export async function destroyTestContext(testContext: TestContext) {
  await testContext.diContainer.dispose()
}
