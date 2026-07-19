import { nextTick, ref } from 'vue'
import { describe, expect, it } from 'vitest'

import { useAnimatedCounter } from '@/composables/useAnimatedCounter'
import { setReducedMotion } from '../../test/setup'

describe('useAnimatedCounter', () => {
  it('snaps to the value immediately under reduced motion', async () => {
    setReducedMotion(true)
    const source = ref(58)
    const display = useAnimatedCounter(source)
    expect(display.value).toBe(58)
    source.value = 12
    await nextTick()
    expect(display.value).toBe(12)
    setReducedMotion(false)
  })

  it('starts from zero while the tween is pending (motion on)', () => {
    setReducedMotion(false)
    const display = useAnimatedCounter(ref(90))
    expect(display.value).toBe(0)
  })
})
