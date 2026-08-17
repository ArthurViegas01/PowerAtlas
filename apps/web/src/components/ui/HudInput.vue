<script setup lang="ts">
import { ref } from 'vue'

/**
 * Canonical HUD text input (design system, ID-5). Same border and focus
 * language as HudButton; exposes focus() for parents that open it from the
 * keyboard (the command palette does).
 */
defineProps<{ modelValue: string; placeholder?: string }>()

const emit = defineEmits<{ (event: 'update:modelValue', value: string): void }>()

const el = ref<HTMLInputElement | null>(null)

defineExpose({ focus: () => el.value?.focus() })
</script>

<template>
  <input
    ref="el"
    class="hud-input pa-data pa-focusable"
    :value="modelValue"
    :placeholder="placeholder"
    type="text"
    autocomplete="off"
    spellcheck="false"
    @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
  />
</template>

<style scoped>
.hud-input {
  width: 100%;
  height: var(--pa-control-h-lg);
  padding: 0 var(--pa-space-3);
  font-size: var(--pa-text-sm);
  letter-spacing: 0.08em;
  color: var(--pa-text-primary);
  background: var(--pa-bg-inset);
  border: 1px solid var(--pa-border-cyan);
}

.hud-input:hover {
  border-color: var(--pa-border-cyan-strong);
}

.hud-input::placeholder {
  color: var(--pa-text-faint);
  font-size: var(--pa-text-2xs);
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
</style>
