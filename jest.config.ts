import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Stub out Prisma so tests don't need a generated client or a live DB
    '^@prisma/client$': '<rootDir>/src/__tests__/__mocks__/prisma-stub.ts',
    '^\\.prisma/client(.*)$': '<rootDir>/src/__tests__/__mocks__/prisma-stub.ts',
  },
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  setupFilesAfterEnv: [],
}

export default createJestConfig(config)
