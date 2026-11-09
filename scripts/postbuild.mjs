// Fallback de rotas do React em hospedagem estatica: deep links (ex.: /clientes) caem no index.html.
// Render usa 404.html para caminhos desconhecidos; o render.yaml (Blueprint) tambem define um rewrite.
import { copyFileSync } from 'node:fs'
copyFileSync('dist/index.html', 'dist/404.html')
console.log('postbuild: dist/404.html criado (fallback SPA)')
