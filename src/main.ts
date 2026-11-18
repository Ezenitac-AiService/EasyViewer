import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './assets/main.css'
import { platformMigration } from '@/services/platform/migrationService'

const app = createApp(App)
app.use(createPinia())
app.use(router)

// Book paths copied from the legacy app must point at the copy before the library loads, so
// that removing a book can never touch the original (spec 003 US6). No-op outside desktop.
platformMigration
  .relinkLegacyLibraryPaths()
  .catch(() => 0)
  .finally(() => app.mount('#app'))

