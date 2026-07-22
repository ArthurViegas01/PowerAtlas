<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

import { version } from '../../../package.json'

/** UTC clock + build tag, bottom-right (above the map attribution). */
const clock = ref('--:--:--Z')
let timer: number | undefined

function tick() {
  clock.value = `${new Date().toISOString().slice(11, 19)}Z`
}

onMounted(() => {
  tick()
  timer = window.setInterval(tick, 1000)
})

onBeforeUnmount(() => window.clearInterval(timer))
</script>

<template>
  <div class="hud-clock" role="timer" aria-label="Relógio UTC">
    <p class="clock pa-data">{{ clock }}</p>
    <p class="pa-label">SIMULAÇÃO · v{{ version }}</p>
  </div>
</template>

<style scoped>
.hud-clock {
  position: absolute;
  right: 24px;
  bottom: 44px;
  z-index: 18;
  text-align: right;
}

.clock {
  margin: 0;
  font-size: var(--pa-text-sm);
  color: var(--pa-text-primary);
}

.hud-clock :nth-child(2) {
  margin: 2px 0 0;
}

@media (max-width: 900px) {
  .hud-clock {
    display: none;
  }
}
</style>
