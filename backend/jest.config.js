export default {
    transform: {},
    testEnvironment: 'node',
    coverageDirectory: 'coverage',
    collectCoverageFrom: [
        'src/modules/**/*.js',
        'src/middleware/**/*.js',
    ],
};
