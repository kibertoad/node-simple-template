/* eslint-disable max-statements */

import type http from 'http'

import { diContainer, fastifyAwilixPlugin } from '@fastify/awilix'
import { fastifyCors } from '@fastify/cors'
import fastifyHelmet from '@fastify/helmet'
import fastifySwagger from '@fastify/swagger'
import fastifySwaggerUi from '@fastify/swagger-ui'
import {
  getRequestIdFastifyAppConfig,
  metricsPlugin,
  requestContextProviderPlugin,
  publicHealthcheckPlugin,
  healthcheckMetricsPlugin,
} from '@lokalise/fastify-extras'
import { resolveGlobalErrorLogObject } from '@lokalise/node-core'
import type { AwilixContainer } from 'awilix'
import fastify from 'fastify'
import type { FastifyInstance, FastifyBaseLogger } from 'fastify'
import fastifyGracefulShutdown from 'fastify-graceful-shutdown'
import fastifyNoIcon from 'fastify-no-icon'
import {
  createJsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'

import {
  getConfig,
  isDevelopment,
  isTest,
} from './infrastructure/config'
import type { DependencyOverrides } from './infrastructure/diConfig'
import { registerDependencies } from './infrastructure/diConfig'
import { errorHandler } from './infrastructure/errors/errorHandler'
import {
  dbHealthCheck,
  runAllHealthchecks,
  wrapHealthCheckForPrometheus,
} from './infrastructure/healthchecks'
import { resolveLoggerConfiguration } from './infrastructure/logger'
import { getRoutes } from './modules/routes'

const GRACEFUL_SHUTDOWN_TIMEOUT_IN_MSECS = 10000

export type ConfigOverrides = {
  diContainer?: AwilixContainer
  healthchecksEnabled?: boolean
  monitoringEnabled?: boolean
}

export async function getApp(
  configOverrides: ConfigOverrides = {},
  dependencyOverrides: DependencyOverrides = {},
): Promise<
  FastifyInstance<http.Server, http.IncomingMessage, http.ServerResponse, FastifyBaseLogger>
> {
  const config = getConfig()
  const appConfig = config.app
  const loggerConfig = resolveLoggerConfiguration(appConfig)
  const enableRequestLogging = ['debug', 'trace'].includes(appConfig.logLevel)

  const app = fastify<http.Server, http.IncomingMessage, http.ServerResponse, FastifyBaseLogger>({
    ...getRequestIdFastifyAppConfig(),
    logger: loggerConfig,
    disableRequestLogging: !enableRequestLogging,
  })

  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  // In production this should ideally be handled outside of application, e. g.
  // on nginx or kubernetes level, but for local development it is convenient
  // to have these headers set by application.
  // If this service is never called from the browser, this entire block can be removed.
  if (isDevelopment()) {
    await app.register(fastifyCors, {
      origin: '*',
      credentials: true,
      methods: ['GET', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Origin', 'X-Requested-With', 'Accept', 'Content-Type', 'Authorization'],
      exposedHeaders: [
        'Access-Control-Allow-Origin',
        'Access-Control-Allow-Methods',
        'Access-Control-Allow-Headers',
      ],
    })
  }

  await app.register(
    fastifyHelmet,
    isDevelopment()
      ? {
          contentSecurityPolicy: false,
        }
      : {},
  )

  if (!isDevelopment()) {
    await app.register(fastifyGracefulShutdown, {
      resetHandlersOnInit: true,
      timeout: GRACEFUL_SHUTDOWN_TIMEOUT_IN_MSECS,
    })
  }

  await app.register(fastifyNoIcon)

  await app.register(fastifySwagger, {
    transform: createJsonSchemaTransform({
      skipList: [
        '/documentation/',
        '/documentation/initOAuth',
        '/documentation/json',
        '/documentation/uiConfig',
        '/documentation/yaml',
        '/documentation/*',
        '/documentation/static/*',
        '*',
      ],
    }),
    openapi: {
      info: {
        title: 'SampleApi',
        description: 'Sample backend service',
        version: '1.0.0',
      },
      servers: [
        {
          url: `http://${
            appConfig.bindAddress === '0.0.0.0' ? 'localhost' : appConfig.bindAddress
          }:${appConfig.port}`,
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
  })

  await app.register(fastifySwaggerUi)
  await app.register(fastifyAwilixPlugin, {
    disposeOnClose: true,
    asyncDispose: true,
    asyncInit: true,
  })

  app.setErrorHandler(errorHandler)

  registerDependencies(
    configOverrides.diContainer ?? diContainer,
    {
      app: app,
      logger: app.log,
    },
    dependencyOverrides,
    {
    },
  )

  if (configOverrides.monitoringEnabled) {
    await app.register(metricsPlugin, {
      bindAddress: appConfig.bindAddress,
      errorObjectResolver: resolveGlobalErrorLogObject,
      loggerOptions: loggerConfig,
      disablePrometheusRequestLogging: true,
    })
  }

  if (configOverrides.healthchecksEnabled !== false) {
    await app.register(publicHealthcheckPlugin, {
      url: '/health',
      healthChecks: [
        {
          name: 'mysql',
          isMandatory: true,
          checker: dbHealthCheck,
        },
      ],
      responsePayload: {
        version: appConfig.appVersion,
      },
    })

    if (configOverrides.monitoringEnabled) {
      await app.register(healthcheckMetricsPlugin, {
        healthChecks: [
          wrapHealthCheckForPrometheus(dbHealthCheck, 'mysql'),
        ],
      })
    }
  }
  await app.register(requestContextProviderPlugin)

  app.after(() => {
    // Register routes
    const { routes } = getRoutes()
    routes.forEach((route) => app.withTypeProvider<ZodTypeProvider>().route(route))

    // Graceful shutdown hook
    if (!isDevelopment()) {
      app.gracefulShutdown((signal, next) => {
        app.log.info('Starting graceful shutdown')
        next()
      })
    }
  })

  try {
    await app.ready()
    if (!isTest() && configOverrides.healthchecksEnabled !== false) {
      await runAllHealthchecks(app)
    }
  } catch (err) {
    app.log.error('Error while initializing app: ', err)
    throw err
  }

  return app
}
