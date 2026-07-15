<script setup lang="ts">
import gsap from 'gsap'
import { ref, watch } from 'vue'

import { useReducedMotion } from '@/composables/useReducedMotion'
import { useSelectionStore } from '@/stores/selection'

const selection = useSelectionStore()
const reduced = useReducedMotion()

const sweep = ref<HTMLElement | null>(null)
const ring = ref<HTMLElement | null>(null)

watch(
  () => selection.pingSeq,
  () => {
    if (reduced.value) return
    const sweepEl = sweep.value
    const ringEl = ring.value
    if (!sweepEl || !ringEl) return

    const point = selection.lastPing ?? {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    }

    gsap.killTweensOf([sweepEl, ringEl])
    const timeline = gsap.timeline()
    timeline.fromTo(
      sweepEl,
      { y: -40, autoAlpha: 0.9 },
      { y: window.innerHeight + 40, autoAlpha: 0, duration: 0.65, ease: 'power2.inOut' },
      0,
    )
    timeline.fromTo(
      ringEl,
      { x: point.x, y: point.y, scale: 0.15, autoAlpha: 0.95 },
      { x: point.x, y: point.y, scale: 2.6, autoAlpha: 0, duration: 0.7, ease: 'power2.out' },
      0.05,
    )
  },
)
</script>

<template>
  <div class="scanfx" aria-hidden="true">
    <div ref="sweep" class="sweep"></div>
    <div ref="ring" class="ring"></div>
  </div>
</template>

<style scoped>
.scanfx {
  position: fixed;
  inset: 0;
  z-index: 35;
  pointer-events: none;
  overflow: hidden;
}

.sweep {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 2px;
  opacity: 0;
  background: linear-gradient(to right, transparent, var(--pa-series-official), transparent);
  box-shadow: 0 0 18px 2px rgba(61, 225, 255, 0.5);
}

.ring {
  position: absolute;
  top: -30px;
  left: -30px;
  width: 60px;
  height: 60px;
  opacity: 0;
  border: 1.5px solid var(--pa-series-official);
  border-radius: 999px;
  box-shadow:
    var(--pa-glow-cyan),
    inset 0 0 12px rgba(61, 225, 255, 0.25);
}
</style>
