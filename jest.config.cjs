/** @type {import('jest').Config} */
const base = require('./jest.config.base.cjs')
const isGitHubActions = process.env.GITHUB_ACTIONS === 'true'

module.exports = {
  ...base,
  testEnvironment: 'node',
  watchman: false,
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapper: {
    '^#generated/(.*)$': '<rootDir>/packages/core/generated/$1',
    '^@/generated/(.*)$': '<rootDir>/generated/$1',
    '^@/lib/(.*)$': '<rootDir>/packages/shared/src/lib/$1',
    '^@/types/(.*)$': '<rootDir>/packages/shared/src/types/$1',
    '^@/modules/dsl$': '<rootDir>/packages/shared/src/modules/dsl.ts',
    '^@/modules/registry$': '<rootDir>/packages/shared/src/modules/registry.ts',
    '^@helios/core/generated/(.*)$': '<rootDir>/packages/core/generated/$1',
    '^@helios/core/(.*)$': '<rootDir>/packages/core/src/$1',
    '^@helios/content/(.*)$': '<rootDir>/packages/content/src/$1',
    '^@helios/cli/(.*)$': '<rootDir>/packages/cli/src/$1',
    '^@helios/events/(.*)$': '<rootDir>/packages/events/src/$1',
    '^@helios/cache/(.*)$': '<rootDir>/packages/cache/src/$1',
    '^@helios/cache$': '<rootDir>/packages/cache/src/index.ts',
    '^@helios/queue/worker$': '<rootDir>/packages/queue/src/worker/runner.ts',
    '^@helios/queue/(.*)$': '<rootDir>/packages/queue/src/$1',
    '^@helios/queue$': '<rootDir>/packages/queue/src/index.ts',
    '^@helios/search/(.*)$': '<rootDir>/packages/search/src/$1',
    '^@helios/search$': '<rootDir>/packages/search/src/index.ts',
    '^@helios/ai-assistant/(.*)$': '<rootDir>/packages/ai-assistant/src/$1',
    '^@helios/ai-assistant$': '<rootDir>/packages/ai-assistant/src/index.ts',
    '^@helios/shared/(.*)$': '<rootDir>/packages/shared/src/$1',
    '^@helios/ui/(.*)$': '<rootDir>/packages/ui/src/$1',
    '^@/\\.helios/generated/(.*)$': '<rootDir>/apps/helios/.helios/generated/$1',
    '^@/generated/(.*)$': '<rootDir>/apps/helios/.helios/generated/$1',
    '^@/(.*)$': '<rootDir>/apps/helios/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1',
  },
  transform: {
    '^.+\\.(t|j)sx?$': [
      '<rootDir>/scripts/jest-mikroorm-transformer.cjs',
      {
        tsconfig: {
          jsx: 'react-jsx',
        },
      },
    ],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@mikro-orm)/)',
  ],
  testMatch: ['**/__tests__/**/*.test.(ts|tsx)'],
  setupFiles: ['<rootDir>/jest.setup.ts'],
  setupFilesAfterEnv: ['<rootDir>/jest.dom.setup.ts'],
  collectCoverageFrom: ['src/**/*.(ts|tsx)', '!src/modules/**/migrations/**'],
  reporters: isGitHubActions
    ? [['github-actions', { silent: false }], 'summary']
    : ['default'],
}
