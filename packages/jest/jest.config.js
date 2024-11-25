/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  collectCoverage: true,
  coverageDirectory: "coverage",
  coverageProvider: "v8",
  testEnvironment: "node",
  roots: ["<rootDir>"],
  testMatch: ["**/*.spec.ts"],
  transform: {
    "^.+\\.tsx?$": "ts-jest",
  },
};
