import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import nodePolyfills from 'rollup-plugin-node-polyfills'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    global: 'window',
    'process.env': {},
    process: 'window.process',
    Buffer: ['buffer', 'Buffer'],
  },
  resolve: {
    alias: {
      stream: 'stream-browserify',
      util: 'util',
      buffer: 'buffer',
      process: 'process/browser',
      assert: 'assert',
      events: 'events',
      crypto: 'crypto-browserify',
      http: 'stream-http',
      https: 'https-browserify',
      os: 'os-browserify/browser',
      url: 'url',
      zlib: 'browserify-zlib',
      path: 'path-browserify',
      fs: resolve(__dirname, 'src/empty-shim.js'),
      net: resolve(__dirname, 'src/empty-shim.js'),
      tls: resolve(__dirname, 'src/empty-shim.js'),
      child_process: resolve(__dirname, 'src/empty-shim.js'),
      dgram: resolve(__dirname, 'src/empty-shim.js'),
      readline: resolve(__dirname, 'src/empty-shim.js'),
      repl: resolve(__dirname, 'src/empty-shim.js'),
      vm: resolve(__dirname, 'src/empty-shim.js'),
      worker_threads: resolve(__dirname, 'src/empty-shim.js'),
    },
  },
  optimizeDeps: {
    include: [
      'process',
      'buffer',
      'stream',
      'util',
      'assert',
      'events',
      'crypto-browserify',
      'stream-http',
      'https-browserify',
      'os-browserify',
      'url',
      'browserify-zlib',
      'path-browserify'
    ],
  },
  build: {
    rollupOptions: {
      plugins: [nodePolyfills()],
    },
  },
})
