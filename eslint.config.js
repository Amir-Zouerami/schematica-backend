const js = require('@eslint/js');
const globals = require('globals');
const stylistic = require('@stylistic/eslint-plugin');

module.exports = [
	{
		ignores: ['dist', 'public', 'app_data'],
	},
	{
		...js.configs.recommended,
		files: ['**/*.js'],
		languageOptions: {
			ecmaVersion: 2020,
			sourceType: 'commonjs',
			globals: globals.node,
		},
		plugins: {
			'@stylistic': stylistic,
		},
		rules: {
			'@stylistic/brace-style': ['error', 'stroustrup', { allowSingleLine: false }],
			'@stylistic/indent': ['error', 'tab', { SwitchCase: 1, MemberExpression: 0 }],
		},
	},
];
