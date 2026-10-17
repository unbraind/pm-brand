/** Apply ESLint to authored TypeScript, including generators and release gates. */
import { ESLint } from 'eslint';
import parser from '@babel/eslint-parser';
const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: [{
  files: ['**/*.ts'], ignores: ['src/font-data.ts', 'src/mark-data.ts'],
  languageOptions: { parser, parserOptions: { requireConfigFile: false, babelOptions: { plugins: [['@babel/plugin-syntax-typescript', { allowDeclareFields: true }]] } } },
  rules: { 'no-eval': 'error', 'no-new-func': 'error', 'no-debugger': 'error', 'no-unreachable': 'error', eqeqeq: 'error', 'no-restricted-syntax': ['error', { selector: 'TSAnyKeyword', message: 'Use a concrete type.' }, { selector: 'TSImportType', message: 'Use a top-level type import.' }, { selector: 'TSEnumDeclaration', message: 'Use erasable TypeScript.' }] },
}] });
const results = await eslint.lintFiles(['src', 'scripts', 'test']);
console.log(await (await eslint.loadFormatter('stylish')).format(results));
if (results.some(result => result.errorCount > 0 || result.warningCount > 0)) process.exit(1);
