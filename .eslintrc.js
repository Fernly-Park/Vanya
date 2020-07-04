module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
       tsconfigRootDir: __dirname,
       project: ['./tsconfig.json'],
    },
  plugins: [
    '@typescript-eslint',
    "jest"
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    "plugin:jest/all"
  ],
  "rules": {
    "no-control-regex": 0,
    "jest/no-hooks": 0,
    "jest/require-to-throw-message": 0
  }
};