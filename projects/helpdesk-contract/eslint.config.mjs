import { defineConfig } from 'eslint/config';
import baseConfig from '../../eslint.config.mjs';

// Plain TypeScript, no Angular: the root config's TypeScript and module
// boundary rules are all this library needs.
export default defineConfig(baseConfig);
