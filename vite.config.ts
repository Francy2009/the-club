import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

const config = defineConfig(({ command, mode }) => ({
  base: mode === 'tauri' ? './' : undefined,
  resolve: { tsconfigPaths: true },
  preview: {
    host: '127.0.0.1',
  },
  plugins: [
    devtools(),
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
