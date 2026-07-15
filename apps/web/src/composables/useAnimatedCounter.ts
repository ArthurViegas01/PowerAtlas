import gsap from 'gsap'
import { getCurrentInstance, onBeforeUnmount, readonly, ref, watch, type Ref } from 'vue'

import { useReducedMotion } from './useReducedMotion'

/**
 * Tweened integer readout: returns a ref that animates toward `value`
 * (0 -> score on mount, then between values). Snaps instantly when
 * prefers-reduced-motion is set.
 */
export function useAnimatedCounter(value: Ref<number>, durationSeconds = 0.9): Readonly<Ref<number>> {
  const reduced = useReducedMotion()
  const display = ref(0)
  const proxy = { value: 0 }
  let tween: gsap.core.Tween | null = null

  function animateTo(target: number) {
    tween?.kill()
    if (reduced.value) {
      proxy.value = target
      display.value = target
      return
    }
    tween = gsap.to(proxy, {
      value: target,
      duration: durationSeconds,
      ease: 'power2.out',
      onUpdate: () => {
        display.value = Math.round(proxy.value)
      },
    })
  }

  watch(value, animateTo, { immediate: true })

  if (getCurrentInstance()) {
    onBeforeUnmount(() => tween?.kill())
  }

  return readonly(display)
}
