import { resolve } from 'path'
import { defineConfig } from 'vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, './index.html'),
      },
    },
  },
  plugins: [
    nodePolyfills({
      overrides: {
        fs: resolve(__dirname, './polyfills/fs'),
        stream: resolve(__dirname, './polyfills/stream'),
      },
      // Not sure what was going on here, but because readable-stream imports
      // this as `require('process/')`, this was not being transformed correctly
      // between ESM and CJS. Excluding it from this plugin and aliasing it
      // below seems to work somehow.
      exclude: ['process'],
    }),
  ],
  resolve: {
    alias: {
      // Note: This doesn't actually seem to produce correct crc32 results.
      '@node-rs/crc32': resolve(__dirname, './src/crc32.js'),
      process: 'process',
    },
  },
})
