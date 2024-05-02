const typescript = require('rollup-plugin-typescript2');

/** @type {import('rollup').RollupOptions} */
module.exports = {
  input: ['src/index.ts'],
  output: {
    file: './index.js',
    format: 'cjs',
  },
  plugins: [
    typescript({
      tsconfig: 'tsconfig.json',
    }),
  ],
};
