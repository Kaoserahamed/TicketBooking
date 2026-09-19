import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      reportsDirectory: './coverage',
      // Only application source is measured: build config, the test helpers and
      // the untestable bootstrap file would otherwise dilute the numbers.
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/test/**', 'src/main.tsx', 'src/**/*.d.ts'],
      // Enforced by `npm run test:coverage` and the CI frontend job.
      // Current actuals sit at ~91% lines/statements, ~76% functions and
      // ~78% branches, so these floors leave a little headroom while still
      // failing the build on a genuine coverage regression.
      thresholds: {
        statements: 90,
        branches: 75,
        functions: 75,
        lines: 90,
      },
    },
  },
})
