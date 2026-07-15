<script setup lang="ts">
withDefaults(defineProps<{ position?: 'tl' | 'tr' | 'bl' | 'br'; size?: number }>(), {
  position: 'tl',
  size: 18,
})
</script>

<template>
  <svg
    class="bracket"
    :class="`bracket--${position}`"
    :width="size"
    :height="size"
    viewBox="0 0 20 20"
    fill="none"
    aria-hidden="true"
  >
    <path d="M1 8V1h7" stroke="currentColor" stroke-width="1.6" />
  </svg>
</template>

<style scoped>
.bracket {
  position: absolute;
  color: var(--pa-border-cyan-strong);
  filter: drop-shadow(0 0 4px rgba(61, 225, 255, 0.45));
  pointer-events: none;
}

.bracket--tl {
  top: -1px;
  left: -1px;
}

.bracket--tr {
  top: -1px;
  right: -1px;
  transform: rotate(90deg);
}

.bracket--br {
  bottom: -1px;
  right: -1px;
  transform: rotate(180deg);
}

.bracket--bl {
  bottom: -1px;
  left: -1px;
  transform: rotate(270deg);
}
</style>
