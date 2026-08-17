<script setup lang="ts">
import type { Component } from 'vue'

/**
 * Canonical HUD action button (design system, ID-5). Ghost outline by
 * default; accent="amber" is reserved for the hidden dimension and the
 * data console; "active" is the toggled-on solid state. Renders as a
 * <button> unless "tag" says otherwise (RouterLink, 'a').
 * States: default, hover glow, focus-visible ring (.pa-focusable),
 * active press, disabled.
 */
withDefaults(
  defineProps<{
    tag?: string | Component
    accent?: 'cyan' | 'amber'
    active?: boolean
  }>(),
  { tag: 'button', accent: 'cyan', active: false },
)
</script>

<template>
  <component
    :is="tag"
    class="hud-btn pa-data pa-focusable"
    :class="{ 'hud-btn--amber': accent === 'amber', 'hud-btn--active': active }"
  >
    <slot />
  </component>
</template>

<style scoped>
.hud-btn {
  padding: var(--pa-space-15) var(--pa-space-3);
  font-size: var(--pa-text-2xs);
  letter-spacing: 0.14em;
  color: var(--pa-series-official);
  text-decoration: none;
  background: transparent;
  border: 1px solid var(--pa-border-cyan);
  cursor: pointer;
  transition:
    box-shadow var(--pa-dur-fast) ease,
    color var(--pa-dur-fast) ease,
    transform var(--pa-dur-fast) ease;
}

.hud-btn:hover:not(:disabled) {
  box-shadow: var(--pa-glow-cyan);
}

.hud-btn:active:not(:disabled) {
  transform: scale(0.98);
}

.hud-btn:disabled {
  color: var(--pa-text-faint);
  border-color: var(--pa-border-faint);
  cursor: default;
}

/* Amber accent: reserved for the hidden dimension / the data console. */
.hud-btn--amber {
  color: var(--pa-series-hidden);
  border-color: color-mix(in srgb, var(--pa-series-hidden) 45%, transparent);
}

.hud-btn--amber:hover:not(:disabled) {
  box-shadow: var(--pa-glow-amber);
}

/* Toggled-on state: stays clickable to exit. */
.hud-btn--active {
  color: var(--pa-bg-void);
  background: var(--pa-series-official);
  box-shadow: var(--pa-glow-cyan);
}
</style>
