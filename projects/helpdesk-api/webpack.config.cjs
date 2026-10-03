// The Helpdesk API's webpack build. Nx infers the `build` target from this
// file (@nx/webpack/plugin in nx.json). NxAppWebpackPlugin compiles with tsc,
// so NestJS gets decorator metadata, and bundles the source-only
// @helpdesk/contract into the output, so dist/ runs on its own; packages
// from node_modules stay external and load at run time.
const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('path');

const production = process.env['NODE_ENV'] === 'production';

module.exports = {
  output: {
    path: join(__dirname, '../../dist/projects/helpdesk-api'),
    clean: true,
    // Stack traces point at the TypeScript sources outside production.
    ...(!production && {
      devtoolModuleFilenameTemplate: '[absolute-resource-path]',
    }),
  },
  plugins: [
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      main: './src/main.ts',
      tsConfig: './tsconfig.app.json',
      assets: [],
      optimization: false,
      outputHashing: 'none',
      generatePackageJson: false,
      sourceMap: !production,
    }),
  ],
};
