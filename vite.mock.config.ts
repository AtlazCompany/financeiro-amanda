// Build/preview de TESTE LOCAL com backend falso (src/dev/mockSupabase.ts). Nunca usado em producao.
import path from 'node:path'
import { mergeConfig } from 'vite'
import base from './vite.config'

export default mergeConfig(base, {
  resolve: {
    alias: [{ find: /^\.\.\/lib\/supabase$/, replacement: path.resolve(__dirname, 'src/dev/mockSupabase.ts') }],
  },
  build: { outDir: 'dist-mock' },
})
