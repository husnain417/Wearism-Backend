export default {
    env: { es2022: true, node: true },
    extends: ['eslint:recommended', 'prettier'],
    parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
    rules: {
        'no-console': 'warn', // use app.log instead
        'no-unused-vars': 'error',
        'no-undef': 'error',
    }
};
