import { types } from 'node:util'

import type {
  HealthChecker,
  HealthcheckResult,
  PrometheusHealthCheck,
} from '@lokalise/fastify-extras'
import type { Either } from '@lokalise/node-core'
import { executeSettleAllAndHandleGlobalErrors } from '@lokalise/node-core'
import type { FastifyInstance } from 'fastify'

export const wrapHealthCheck = (app: FastifyInstance, healthCheck: HealthChecker) => {
  return async () => {
    const response = await healthCheck(app)
    if (response.error) {
      throw response.error
    }
  }
}

export const wrapHealthCheckForPrometheus = (
  healthCheck: HealthChecker,
  healthcheckName: string,
): PrometheusHealthCheck => {
  return {
    name: healthcheckName,
    checker: async (app: FastifyInstance): Promise<HealthcheckResult> => {
      const startTime = Date.now()
      const response = await healthCheck(app)
      const checkTimeInMsecs = Date.now() - startTime

      return {
        checkPassed: !!response.result,
        checkTimeInMsecs,
      }
    },
  }
}

export const dbHealthCheck: HealthChecker = async (app): Promise<Either<Error, true>> => {
  const prisma = app.diContainer.cradle.prisma
  try {
    const response = await prisma.$queryRaw`SELECT 1`
    if (!response) {
      return {
        error: new Error('DB healthcheck got an unexpected response'),
      }
    }
  } catch (error) {
    if (types.isNativeError(error)) {
      return {
        error: new Error(`An error occurred during DB healthcheck: ${error.message}`),
      }
    }
    return {
      error: new Error('An unexpected error occurred during DB healthcheck'),
    }
  }
  return { result: true }
}

export async function runAllHealthchecks(app: FastifyInstance) {
  return executeSettleAllAndHandleGlobalErrors(
    [wrapHealthCheck(app, dbHealthCheck)()],
    false,
  )
}
