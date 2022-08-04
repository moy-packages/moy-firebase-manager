/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  modulePaths: ['./tests'],
  testPathIgnorePatterns: ['lib', 'tests/__mocks'],
};
