import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { readFileSync } from 'node:fs'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

const tauriConfig = JSON.parse(readFileSync(new URL('./src-tauri/tauri.conf.json', import.meta.url), 'utf8')) as {
  version?: string
}
const appVersion = tauriConfig.version ?? '0.0.0'

const config = defineConfig(({ command, mode }) => ({
  base: mode === 'tauri' ? './' : undefined,
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  resolve: { tsconfigPaths: true },
  preview: {
    host: '127.0.0.1',
  },
  plugins: [
    // Only include devtools in development mode
    command === 'serve' && devtools(),
    command === 'serve' && process.env.TSS_PRERENDERING !== 'true'
      ? basicSsl()
      : null,
    tailwindcss(),
    tanstackStart(
      mode === 'tauri'
        ? {
            sitemap: {
              enabled: false,
            },
            spa: {
              enabled: true,
              prerender: {
                outputPath: '/index',
              },
            },
          }
        : undefined,
    ),
    viteReact(),
  ],
}))

export default config
