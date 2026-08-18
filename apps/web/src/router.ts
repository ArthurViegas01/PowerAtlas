import { createRouter, createWebHistory } from 'vue-router'

import MapScreen from '@/screens/MapScreen.vue'

/**
 * Two screens: the map HUD ('/') and the data console ('/dados'). History mode
 * needs the SPA fallback (netlify.toml) so a hard reload on /dados resolves.
 * The console is lazy-loaded (its own chunk) so the map's initial load (the
 * default entry) stays lean.
 */
export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'map', component: MapScreen },
    {
      path: '/dados',
      name: 'data-console',
      component: () => import('@/screens/DataConsoleScreen.vue'),
    },
    {
      // Side-by-side comparison (PROD-2); deep link via ?ids=SP,RS.
      path: '/comparar',
      name: 'compare',
      component: () => import('@/screens/CompareScreen.vue'),
    },
    {
      // Methodology and sources (IA-1): the conceptual weight off the map.
      path: '/sobre',
      name: 'about',
      component: () => import('@/screens/AboutScreen.vue'),
    },
    {
      // Living styleguide (ID-6): lazy and out of the production nav.
      path: '/estilo',
      name: 'styleguide',
      component: () => import('@/screens/StyleGuideScreen.vue'),
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})
