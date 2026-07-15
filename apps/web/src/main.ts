import '@fontsource/fira-code/400.css'
import '@fontsource/fira-code/500.css'
import '@fontsource/fira-code/600.css'
import '@fontsource/fira-sans/400.css'
import '@fontsource/fira-sans/600.css'
import 'maplibre-gl/dist/maplibre-gl.css'
import './styles/main.css'

import { createPinia } from 'pinia'
import { createApp } from 'vue'

import App from './App.vue'

createApp(App).use(createPinia()).mount('#app')
