/** @type {import('jest').Config} */
const base = require('../../jest.config.base.cjs')

module.exports = {
  ...base,
  testEnvironment: 'node',
  testTimeout: 30000,
  watchman: false,
  rootDir: '.',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapper: {
    '^#generated/entities\\.ids\\.generated$': '<rootDir>/jest.mocks/entities.ids.generated.js',
    '^#generated/(.*)$': '<rootDir>/generated/$1',
    '^@helios/core/generated/entities\\.ids\\.generated$': '<rootDir>/jest.mocks/entities.ids.generated.js',
    '^@helios/core/generated/(.*)$': '<rootDir>/generated/$1',
    '^@helios/core/(.*)$': '<rootDir>/src/$1',
    '^@helios/cache$': '<rootDir>/../cache/src/index.ts',
    '^@helios/cache/(.*)$': '<rootDir>/../cache/src/$1',
    '^@helios/queue/worker$': '<rootDir>/../queue/src/worker/runner.ts',
    '^@helios/queue/(.*)$': '<rootDir>/../queue/src/$1',
    '^@helios/queue$': '<rootDir>/../queue/src/index.ts',
    '^@helios/shared/(.*)$': '<rootDir>/../shared/src/$1',
    '^@helios/ui/(.*)$': '<rootDir>/../ui/src/$1',
    '^@helios/ai-assistant/(.*)$': '<rootDir>/../ai-assistant/src/$1',
    '^@/\\.helios/generated/inbox-actions\\.generated$': '<rootDir>/jest.mocks/inbox-actions.generated.js',
    '^react-markdown$': '<rootDir>/jest.mocks/react-markdown.js',
    '^remark-gfm$': '<rootDir>/jest.mocks/remark-gfm.js',
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
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!(@mikro-orm|kysely|ai|@ai-sdk|ai-sdk-ollama|@workflow|@standard-schema)/)',
  ],
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.(ts|tsx)'],
  passWithNoTests: true,
}
