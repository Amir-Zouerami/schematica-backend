const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
	{
		files: ['**/*.js'],
		languageOptions: {
			ecmaVersion: 'latest',
			sourceType: 'module',
			globals: {
				...globals.browser,
				...globals.node,
			},
		},
		rules: {
			'no-unused-vars': 'warn',
			'no-undef': 'error',

			eqeqeq: ['error', 'always'],
			curly: 'error',
			'no-var': 'error',
			'prefer-const': 'error',

			'no-alert': 'error',
			'no-eval': 'error',
			'no-implicit-globals': 'error',
		},
	},
	js.configs.recommended,
];
