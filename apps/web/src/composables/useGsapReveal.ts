import gsap from 'gsap'
import { onBeforeUnmount, onMounted, type Ref } from 'vue'

import { useReducedMotion } from './useReducedMotion'

export interface RevealOptions {
  /** Elements to stagger in; defaults to everything marked [data-reveal]. */
  selector?: string
  stagger?: number
  delay?: number
  y?: number
  duration?: number
}

/**
 * Staggered HUD entrance for the children of `root`. Runs once on mount —
 * remount with a changing :key to replay (the ranking panel keys itself by
 * region id). No-ops entirely under prefers-reduced-motion.
 */
export function useGsapReveal(root: Ref<HTMLElement | null>, options: RevealOptions = {}) {
  const reduced = useReducedMotion()
  let context: gsap.Context | null = null

  onMounted(() => {
    const el = root.value
    if (!el || reduced.value) return
    context = gsap.context(() => {
      gsap.fromTo(
        options.selector ?? '[data-reveal]',
        { y: options.y ?? 14, autoAlpha: 0 },
        {
          y: 0,
          autoAlpha: 1,
          duration: options.duration ?? 0.5,
          stagger: options.stagger ?? 0.055,
          delay: options.delay ?? 0.05,
          ease: 'power3.out',
          clearProps: 'transform,opacity,visibility',
        },
      )
    }, el)
  })

  onBeforeUnmount(() => context?.revert())
}
