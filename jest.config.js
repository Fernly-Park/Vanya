module.exports = {
    "roots": [
      "<rootDir>/tests"
    ],
    "testMatch": [
      "**/__tests__/**/*.+(ts|tsx|js)",
      "**/?(*.)+(spec|test).+(ts|tsx|js)"
    ],
    "transform": {
      "^.+\\.(ts|tsx)$": "ts-jest"
    },
    setupFilesAfterEnv: ['./tests/jest.setup.ts'],
    moduleNameMapper: {
      '^@App/(.*)$': '<rootDir>/src/$1',
      '^@Tests/(.*)$': '<rootDir>/tests/$1'
    }
  }