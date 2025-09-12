import { fastifyAwilixPlugin } from '@fastify/awilix'
import { InternalError } from '@lokalise/node-core'
import { asFunction } from 'awilix'
import type { RouteHandlerMethod } from 'fastify'
import fastify from 'fastify'
import { afterAll, describe, expect, it } from 'vitest'
import type { AppInstance } from '../../app.ts'

import { errorHandler } from './errorHandler.ts'
import { AuthFailedError } from './publicErrors.ts'

async function initApp(routeHandler: RouteHandlerMethod, awaitApp = true): Promise<AppInstance> {
  const app: AppInstance = fastify()
  void app.register(fastifyAwilixPlugin, { disposeOnClose: true })
  app.setErrorHandler(errorHandler)

  app.route({
    method: 'GET',
    url: '/',
    handler: routeHandler,
  })
  if (awaitApp) {
    await app.ready()

    app.diContainer.register(
      'errorReporter',
      asFunction(() => {
        return {
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          report: () => {},
        }
      }),
    )
  }

  return app
}

describe('errorHandler', () => {
  let app: AppInstance
  afterAll(async () => {
    await app.close()
  })

  it('returns 500 internal error by default', async () => {
    app = await initApp(() => {
      throw new Error('Generic error')
    })

    const response = await app.inject().get('/').end()

    expect(response.statusCode).toBe(500)
    expect(response.json()).toEqual({
      errorCode: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
    })
  })

  it('responds with AUTH_FAILED in case of internal auth failed error', async () => {
    app = await initApp(() => {
      throw new AuthFailedError({ message: 'Auth failed', details: { someDetails: 'details' } })
    })

    const response = await app.inject().get('/').end()

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({
      message: 'Auth failed',
      errorCode: 'AUTH_FAILED',
      details: { someDetails: 'details' },
    })
  })

  it('returns 500 for InternalError', async () => {
    app = await initApp(() => {
      throw new InternalError({
        message: 'Auth failed',
        details: { userId: 4 },
        errorCode: 'INT_ERR',
      })
    })

    const response = await app.inject().get('/').end()

    expect(response.statusCode).toBe(500)
    expect(response.json()).toEqual({
      errorCode: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
    })
  })
})
