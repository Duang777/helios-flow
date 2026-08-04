/** @type {import('jest').Config} */
const base = require('../../jest.config.base.cjs')

module.exports = {
  ...base,
  testEnvironment: 'node',
  watchman: false,
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapper: {
    '^@helios/core/(.*)$': '<rootDir>/../core/src/$1',
    '^@helios/shared/(.*)$': '<rootDir>/../shared/src/$1',
    '^@helios/cache$': '<rootDir>/../cache/src/index.ts',
    '^@helios/queue/(.*)$': '<rootDir>/../queue/src/$1',
    '^@helios/events/(.*)$': '<rootDir>/../events/src/$1',
    '^@helios/ui/(.*)$': '<rootDir>/../ui/src/$1',
    // Strip .js extensions from relative imports (@mikro-orm ESM compatibility)
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.(t|j)sx?$': [
      '<rootDir>/../../scripts/jest-mikroorm-transformer.cjs',
      {
        tsconfig: {
          rootDir: '.',
          ignoreDeprecations: '6.0',
          esModuleInterop: true,
          allowJs: true,
        },
      },
    ],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@mikro-orm|kysely|ai|@ai-sdk|ai-sdk-ollama|@workflow|@standard-schema)/)',
  ],
}
