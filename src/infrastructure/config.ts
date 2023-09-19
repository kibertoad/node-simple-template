import { ConfigScope, createRangeValidator } from '@lokalise/node-core'

const configScope: ConfigScope = new ConfigScope()

export type Config = {
  db: DbConfig
  integrations: {
    fakeStore: {
      baseUrl: string
    }
  }
  app: AppConfig
}

export type DbConfig = {
  databaseUrl: string
}

export type AppConfig = {
  port: number
  bindAddress: string
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent'
  nodeEnv: 'production' | 'development' | 'test'
  appEnv: 'production' | 'development' | 'staging'
  appVersion: string
}

export function getConfig(): Config {
  return {
    app: getAppConfig(),
    db: getDbConfig(),
    integrations: {
      fakeStore: {
        baseUrl: configScope.getMandatory('SAMPLE_FAKE_STORE_BASE_URL'),
      },
    },
    }
}

export function getDbConfig(): DbConfig {
  return {
    databaseUrl: configScope.getMandatory('DATABASE_URL'),
  }
}

export function getAppConfig(): AppConfig {
  return {
    port: configScope.getOptionalInteger('APP_PORT', 3000),
    bindAddress: configScope.getMandatory('APP_BIND_ADDRESS'),
    logLevel: configScope.getMandatoryOneOf('LOG_LEVEL', [
      'fatal',
      'error',
      'warn',
      'info',
      'debug',
      'trace',
      'silent',
    ]),
    nodeEnv: configScope.getMandatoryOneOf('NODE_ENV', ['production', 'development', 'test']),
    appEnv: configScope.getMandatoryOneOf('APP_ENV', ['production', 'development', 'staging']),
    appVersion: configScope.getOptional('APP_VERSION', 'VERSION_NOT_SET'),
  }
}

export function isDevelopment() {
  return configScope.isDevelopment()
}

export function isTest() {
  return configScope.isTest()
}

export function isProduction() {
  return configScope.isProduction()
}
