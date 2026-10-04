// The Helpdesk API's webpack build. Nx infers the `build` target from this
// file (@nx/webpack/plugin in nx.json). NxAppWebpackPlugin compiles with tsc,
// so NestJS gets decorator metadata, and bundles the source-only
// @helpdesk/contract into the output, so dist/ runs on its own; packages
// from node_modules stay external and load at run time. The output also gets
// a package.json listing just those packages (and a lockfile pinning them),
// so the Docker image installs only what the API uses, plus the migrations.
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
      // setup.js: migrates (and may seed) the database before main.js runs.
      additionalEntryPoints: [
        { entryName: 'setup', entryPath: './src/database/setup-cli.ts' },
      ],
      tsConfig: './tsconfig.app.json',
      // The SQL migrations, applied when the container starts.
      assets: [{ input: './drizzle', glob: '**/*', output: 'drizzle' }],
      optimization: false,
      outputHashing: 'none',
      generatePackageJson: true,
      sourceMap: !production,
    }),
  ],
};
