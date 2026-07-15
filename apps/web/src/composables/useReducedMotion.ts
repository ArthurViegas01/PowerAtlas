import { getCurrentInstance, onBeforeUnmount, readonly, ref, type Ref } from 'vue'

const QUERY = '(prefers-reduced-motion: reduce)'

/**
 * Reactive `prefers-reduced-motion` flag. Every motion feature (GSAP
 * reveals, counters, map flyTo, scan effects) must gate on this.
 */
export function useReducedMotion(): Readonly<Ref<boolean>> {
  const reduced = ref(typeof window !== 'undefined' && window.matchMedia(QUERY).matches)

  if (typeof window !== 'undefined') {
    const mediaQuery = window.matchMedia(QUERY)
    const onChange = (event: MediaQueryListEvent) => {
      reduced.value = event.matches
    }
    mediaQuery.addEventListener('change', onChange)
    if (getCurrentInstance()) {
      onBeforeUnmount(() => mediaQuery.removeEventListener('change', onChange))
    }
  }

  return readonly(reduced)
}
