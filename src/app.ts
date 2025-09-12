/* eslint-disable max-statements */

import type http from 'node:http'
import { diContainer, fastifyAwilixPlugin } from '@fastify/awilix'
import { fastifyCors } from '@fastify/cors'
import fastifyHelmet from '@fastify/helmet'
import fastifySwagger from '@fastify/swagger'
import {
  getRequestIdFastifyAppConfig,
  healthcheckMetricsPlugin,
  metricsPlugin,
  publicHealthcheckPlugin,
  requestContextProviderPlugin,
} from '@lokalise/fastify-extras'
import { type CommonLogger, resolveGlobalErrorLogObject, resolveLogger } from '@lokalise/node-core'
import scalarFastifyApiReference from '@scalar/fastify-api-reference'
import type { AwilixContainer } from 'awilix'
import type { FastifyInstance } from 'fastify'
import fastify from 'fastify'
import fastifyGracefulShutdown from 'fastify-graceful-shutdown'
import fastifyNoIcon from 'fastify-no-icon'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import {
  createJsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod'
import { stdSerializers } from 'pino'
import { getConfig, isDevelopment, isTest } from './infrastructure/config.ts'
import type { DependencyOverrides } from './infrastructure/diConfig.ts'
import { registerDependencies } from './infrastructure/diConfig.ts'
import { errorHandler } from './infrastructure/errors/errorHandler.ts'
import {
  dbHealthCheck,
  runAllHealthchecks,
  wrapHealthCheckForPrometheus,
} from './infrastructure/healthchecks.ts'
import { getRoutes } from './modules/routes.ts'

const GRACEFUL_SHUTDOWN_TIMEOUT_IN_MSECS = 10000

export type ConfigOverrides = {
  diContainer?: AwilixContainer
  healthchecksEnabled?: boolean
  monitoringEnabled?: boolean
}

export type AppInstance = FastifyInstance<
  http.Server,
  http.IncomingMessage,
  http.ServerResponse,
  CommonLogger
>

export async function getApp(
  configOverrides: ConfigOverrides = {},
  dependencyOverrides: DependencyOverrides = {},
): Promise<AppInstance> {
  const config = getConfig()
  const appConfig = config.app
  const logger = resolveLogger(appConfig)
  const enableRequestLogging = ['debug', 'trace'].includes(appConfig.logLevel)

  const app = fastify<http.Server, http.IncomingMessage, http.ServerResponse, CommonLogger>({
    ...getRequestIdFastifyAppConfig(),
    loggerInstance: logger,
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

  await app.register(fastifyNoIcon.default)

  await app.register(fastifySwagger, {
    transform: createJsonSchemaTransform({
      skipList: [
        '/documentation/',
        '/documentation/initOAuth',
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

  await app.register(scalarFastifyApiReference, {
    routePrefix: '/documentation',
  })
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
    {},
  )

  if (configOverrides.monitoringEnabled) {
    await app.register(metricsPlugin, {
      bindAddress: appConfig.bindAddress,
      errorObjectResolver: resolveGlobalErrorLogObject,
      logger,
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
        healthChecks: [wrapHealthCheckForPrometheus(dbHealthCheck, 'mysql')],
      })
    }
  }
  await app.register(requestContextProviderPlugin)

  app.after(() => {
    // Register routes
    const { routes } = getRoutes()
    routes.forEach((route) => {
      app.withTypeProvider<ZodTypeProvider>().route(route)
    })

    // Graceful shutdown hook
    if (!isDevelopment()) {
      app.gracefulShutdown(() => {
        app.log.info('Starting graceful shutdown')
      })
    }
  })

  try {
    await app.ready()
    if (!isTest() && configOverrides.healthchecksEnabled !== false) {
      await runAllHealthchecks(app)
    }
  } catch (err) {
    app.log.error({ error: stdSerializers.err(err as Error) }, 'Error while initializing app')
    throw err
  }

  return app
}
