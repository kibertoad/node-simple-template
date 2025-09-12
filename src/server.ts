/* istanbul ignore file */

import {
  executeAndHandleGlobalErrors,
  globalLogger,
  resolveGlobalErrorLogObject,
} from '@lokalise/node-core'

if (process.env.NEW_RELIC_ENABLED !== 'false') {
  // NewRelic performs magic by importing environment variables automatically
  // https://docs.newrelic.com/docs/apm/agents/nodejs-agent/installation-configuration/nodejs-agent-configuration/#environment
  require('newrelic')
}

import { getApp } from './app.ts'
import type { Config } from './infrastructure/config.ts'
import { getConfig } from './infrastructure/config.ts'

async function start() {
  globalLogger.info('Starting application...')
  const config = executeAndHandleGlobalErrors<Config>(getConfig)
  const app = await getApp({})

  try {
    await app.listen({
      host: config.app.bindAddress,
      port: config.app.port,
      listenTextResolver: (address) => {
        return `Template app listening at ${address}`
      },
    })
  } catch (err) {
    app.log.error(resolveGlobalErrorLogObject(err))
    process.exit(1)
  }
}

void start()
