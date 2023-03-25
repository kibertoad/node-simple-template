import { InternalError } from '@lokalise/node-core'
import type { PrismaClient } from '@prisma/client'

import type { Dependencies } from './diConfig'
import { executeAsyncAndHandleGlobalErrors } from './errors/globalErrorHandler'

const HEALTHCHECK_ERROR_CODE = 'HEALTHCHECK_ERROR'

export async function testDbHealth(prisma: PrismaClient) {
  const response = await prisma.$queryRaw`SELECT 1`
  if (!response) {
    throw new InternalError({
      message: 'Database did not respond correctly',
      errorCode: HEALTHCHECK_ERROR_CODE,
    })
  }
}

export async function runAllHealthchecks(dependencies: Dependencies) {
  return executeAsyncAndHandleGlobalErrors(
    () => Promise.all([testDbHealth(dependencies.prisma)]),
    false,
  )
}
