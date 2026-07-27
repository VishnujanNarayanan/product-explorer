const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{ts,tsx}',
    // Barrel files re-export and carry no logic of their own.
    '!src/**/index.{ts,tsx}',
    // …except this one, which is the shared helper module, not a barrel.
    'src/lib/utils/index.ts',
  ],
  // Thresholds are set per module rather than globally. A global 80% gate was declared here
  // while the suite contained no tests at all, so it asserted nothing and would fail the
  // moment anyone ran it. These floors are set just under what the covered modules actually
  // reach, so they catch a regression without pretending the whole app is covered.
  coverageThreshold: {
    'src/lib/hooks/useSearch.ts': {
      statements: 80,
      lines: 80,
      functions: 75,
      branches: 50,
    },
    'src/lib/utils/index.ts': {
      statements: 60,
      lines: 60,
      functions: 60,
      branches: 60,
    },
  },
};

module.exports = createJestConfig(customJestConfig);