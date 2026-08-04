/** @type {import('jest').Config} */
const base = require('../../jest.config.base.cjs')

module.exports = {
  ...base,
  testEnvironment: 'node',
  watchman: false,
  rootDir: '.',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapper: {
    '^@/\\.helios/generated/(.*)$': '<rootDir>/.helios/generated/$1',
    '^@/generated/(.*)$': '<rootDir>/.helios/generated/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^#generated/(.*)$': '<rootDir>/../../packages/core/generated/$1',
    '^@helios/core/generated/(.*)$': '<rootDir>/../../packages/core/generated/$1',
    '^@helios/core/(.*)$': '<rootDir>/../../packages/core/src/$1',
    '^@helios/shared/(.*)$': '<rootDir>/../../packages/shared/src/$1',
    '^@helios/ui/(.*)$': '<rootDir>/../../packages/ui/src/$1',
    '^@helios/enterprise$': '<rootDir>/../../packages/enterprise/src/index.ts',
    '^@helios/enterprise/(.*)$': '<rootDir>/../../packages/enterprise/src/$1',
    '^@helios/cache$': '<rootDir>/../../packages/cache/src/index.ts',
    '^@helios/cache/(.*)$': '<rootDir>/../../packages/cache/src/$1',
    '^@helios/queue$': '<rootDir>/../../packages/queue/src/index.ts',
    '^@helios/queue/(.*)$': '<rootDir>/../../packages/queue/src/$1',
    '^@helios/search$': '<rootDir>/../../packages/search/src/index.ts',
    '^@helios/search/(.*)$': '<rootDir>/../../packages/search/src/$1',
    '^@helios/events/(.*)$': '<rootDir>/../../packages/events/src/$1',
    '^@helios/cli/(.*)$': '<rootDir>/../../packages/cli/src/$1',
    '^@helios/content/(.*)$': '<rootDir>/../../packages/content/src/$1',
  },
  transform: {
    '^.+\\.(t|j)sx?$': [
      '<rootDir>/../../scripts/jest-mikroorm-transformer.cjs',
      {
        tsconfig: {
          jsx: 'react-jsx',
          rootDir: '.',
          ignoreDeprecations: '6.0',
        },
      },
    ],
  },
  setupFiles: ['<rootDir>/../../jest.setup.ts'],
  setupFilesAfterEnv: ['<rootDir>/../../jest.dom.setup.ts'],
  transformIgnorePatterns: [
    '/node_modules/(?!(@mikro-orm|kysely|meilisearch|ai|@ai-sdk|ai-sdk-ollama|@workflow|@standard-schema)/)',
    '\\.pnp\\.[^\\/]+$',
  ],
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.(ts|tsx)'],
  passWithNoTests: true,
}
