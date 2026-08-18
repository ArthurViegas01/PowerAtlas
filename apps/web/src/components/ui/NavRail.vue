<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'

/**
 * Vertical navigation rail (IA-1): the PRIMARY destinations, not lenses.
 * Lives in App.vue at the far left on every route; hidden on mobile (the
 * header keeps navigation there until the mobile pass). Icons are hand-drawn
 * geometric strokes (four glyphs do not justify an icon dependency yet; the
 * ID-4 decision to adopt a stroke set stands for when the count grows).
 */
const route = useRoute()

const ITEMS = [
  { to: '/', label: 'MAPA', title: 'Mapa (a casa)', icon: 'map' },
  { to: '/comparar', label: 'COMP', title: 'Comparar regiões', icon: 'compare' },
  { to: '/dados', label: 'DADOS', title: 'Console de dados', icon: 'data' },
  { to: '/sobre', label: 'SOBRE', title: 'Metodologia e fontes', icon: 'about' },
] as const

const isActive = (to: string) => (to === '/' ? route.path === '/' : route.path.startsWith(to))
</script>

<template>
  <nav class="rail" aria-label="Navegação principal">
    <p class="rail-brand pa-data" aria-hidden="true">PA</p>
    <RouterLink
      v-for="item in ITEMS"
      :key="item.to"
      :to="item.to"
      class="rail-item pa-focusable"
      :class="{ 'rail-item--active': isActive(item.to) }"
      :title="item.title"
      :aria-current="isActive(item.to) ? 'page' : undefined"
    >
      <svg class="rail-icon" viewBox="0 0 20 20" aria-hidden="true">
        <template v-if="item.icon === 'map'">
          <path d="M3 5 8 3l4 2 5-2v12l-5 2-4-2-5 2Z" />
          <path d="M8 3v12M12 5v12" />
        </template>
        <template v-else-if="item.icon === 'compare'">
          <rect x="3" y="7" width="5" height="10" />
          <rect x="12" y="3" width="5" height="14" />
        </template>
        <template v-else-if="item.icon === 'data'">
          <ellipse cx="10" cy="5" rx="6" ry="2.4" />
          <path d="M4 5v10c0 1.3 2.7 2.4 6 2.4s6-1.1 6-2.4V5" />
          <path d="M4 10c0 1.3 2.7 2.4 6 2.4s6-1.1 6-2.4" />
        </template>
        <template v-else>
          <rect x="3.5" y="3.5" width="13" height="13" />
          <path d="M10 9v5" />
          <path d="M10 6.2v.2" />
        </template>
      </svg>
      <span class="rail-label pa-label">{{ item.label }}</span>
    </RouterLink>
  </nav>
</template>

<style scoped>
.rail {
  position: fixed;
  top: 0;
  bottom: 0;
  left: 0;
  z-index: var(--pa-z-header);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--pa-space-2);
  width: var(--pa-rail-width);
  padding: var(--pa-space-3) 0;
  background: rgba(3, 6, 8, 0.88);
  border-right: 1px solid var(--pa-border-faint);
}

.rail-brand {
  margin: 0 0 var(--pa-space-3);
  font-size: var(--pa-text-sm);
  font-weight: 600;
  letter-spacing: 0.18em;
  color: var(--pa-series-official);
  text-shadow: 0 0 10px rgba(61, 225, 255, 0.4);
}

.rail-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--pa-space-05);
  width: calc(var(--pa-rail-width) - var(--pa-space-2));
  padding: var(--pa-space-15) 0;
  color: var(--pa-text-dim);
  text-decoration: none;
  border: 1px solid transparent;
  transition: color var(--pa-dur-fast) ease, border-color var(--pa-dur-fast) ease;
}

.rail-item:hover {
  color: var(--pa-text-primary);
}

.rail-item--active {
  color: var(--pa-series-official);
  border-color: var(--pa-border-cyan);
  background: color-mix(in srgb, var(--pa-series-official) 8%, transparent);
}

.rail-icon {
  width: var(--pa-icon-md);
  height: var(--pa-icon-md);
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.rail-label {
  font-size: 9px; /* off-scale on purpose: rail labels are sub-2xs captions */
  color: currentColor;
}

@media (max-width: 900px) {
  .rail {
    display: none;
  }
}
</style>
