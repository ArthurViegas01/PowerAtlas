<script setup lang="ts">
import { ref } from 'vue'

import { useGsapReveal } from '@/composables/useGsapReveal'

import CornerBracket from './CornerBracket.vue'

defineProps<{ title: string; subtitle?: string }>()

const root = ref<HTMLElement | null>(null)
// Replays on remount — the panel is keyed by region id upstream.
useGsapReveal(root)
</script>

<template>
  <section ref="root" class="hud-panel">
    <CornerBracket position="tl" />
    <CornerBracket position="tr" />
    <CornerBracket position="br" />
    <CornerBracket position="bl" />
    <header class="panel-head" data-reveal>
      <div class="min-w-0">
        <h2 class="panel-title pa-data">{{ title }}</h2>
        <p v-if="subtitle" class="pa-label panel-subtitle">{{ subtitle }}</p>
      </div>
      <slot name="actions" />
    </header>
    <div class="panel-body">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.hud-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  max-height: 100%;
  overflow: hidden;
  background: var(--pa-bg-panel);
  border: 1px solid var(--pa-border-cyan);
  backdrop-filter: blur(10px);
  box-shadow:
    var(--pa-glow-cyan),
    inset 0 0 42px rgba(61, 225, 255, 0.03);
}

.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px 10px;
  border-bottom: 1px solid var(--pa-border-faint);
}

.panel-title {
  margin: 0;
  font-size: var(--pa-text-lg);
  font-weight: 600;
  letter-spacing: 0.1em;
  color: var(--pa-text-primary);
  text-shadow: 0 0 12px rgba(61, 225, 255, 0.35);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.panel-subtitle {
  margin: 4px 0 0;
}

.panel-body {
  padding: 12px 16px 16px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--pa-border-cyan) transparent;
}
</style>
