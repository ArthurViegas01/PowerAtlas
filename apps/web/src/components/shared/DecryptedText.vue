<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { useReducedMotion } from '@/composables/useReducedMotion'

/**
 * HUD text that materializes like a decryption pass: every glyph starts as
 * random cipher noise and resolves left to right into the real string.
 * Whitespace is never scrambled (keeps word shapes stable) and reduced
 * motion renders the plain text immediately.
 */
const props = withDefaults(
  defineProps<{
    text: string
    /** ms before the reveal starts (lets a card stagger its lines). */
    delay?: number
  }>(),
  { delay: 0 },
)

const reduced = useReducedMotion()
const display = ref('')

const CIPHER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&@?*+=<>'
const TICK_MS = 30
/** Characters revealed per tick — fast enough for long municipality names. */
const REVEAL_PER_TICK = 0.8

let timer: number | undefined

function scramble(text: string, revealed: number): string {
  let out = ''
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    out +=
      i < revealed || /\s/.test(char)
        ? char
        : CIPHER[Math.floor(Math.random() * CIPHER.length)]
  }
  return out
}

function stop() {
  if (timer !== undefined) window.clearInterval(timer)
  timer = undefined
}

function start() {
  stop()
  const text = props.text
  if (reduced.value || text.length === 0) {
    display.value = text
    return
  }
  const startAt = performance.now() + props.delay
  display.value = scramble(text, 0)
  timer = window.setInterval(() => {
    const elapsed = performance.now() - startAt
    if (elapsed < 0) {
      display.value = scramble(text, 0)
      return
    }
    const revealed = Math.floor((elapsed / TICK_MS) * REVEAL_PER_TICK)
    if (revealed >= text.length) {
      display.value = text
      stop()
      return
    }
    display.value = scramble(text, revealed)
  }, TICK_MS)
}

watch(() => props.text, start)
onMounted(start)
onBeforeUnmount(stop)
</script>

<template>
  <!-- Screen readers get the real text; the cipher noise stays visual-only. -->
  <span :aria-label="props.text">
    <span aria-hidden="true">{{ display }}</span>
  </span>
</template>
