import { defineConfig } from 'eslint/config';
import baseConfig from '../../eslint.config.mjs';

// Plain TypeScript (NestJS), no Angular: the root config's TypeScript and
// module boundary rules are all this app needs.
export default defineConfig(baseConfig);
