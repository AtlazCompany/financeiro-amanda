// Service worker minimo: dados financeiros exigem conexao, entao nao ha cache de dados.
// Apenas permite que o app seja instalavel e sempre busque a versao mais recente.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
self.addEventListener('fetch', () => {})
