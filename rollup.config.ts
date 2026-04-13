import commonjs from '@rollup/plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import { defineConfig } from 'rollup';

const config = defineConfig({
  input: 'src/index.ts',
  output: {
    esModule: true,
    file: 'dist/index.js',
    format: 'es',
    sourcemap: false,
    compact: true,
  },
  plugins: [typescript(), nodeResolve({ preferBuiltins: true }), commonjs()],
  onwarn(warning, warn) {
    if (warning.code === 'THIS_IS_UNDEFINED') return;
    if (warning.code === 'CIRCULAR_DEPENDENCY' && warning.ids?.every(id => id.includes('node_modules'))) return;
    warn(warning);
  },
});

export default config;
