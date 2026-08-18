import { onBeforeUnmount, ref } from 'vue'

export interface ResizableWidthOptions {
  min: number
  max: number
  default: number
}

/**
 * A user-draggable panel width, persisted to localStorage. Returns the reactive
 * width (px) and a pointerdown handler to wire to a grip on the panel's right
 * edge. The map's side panels live in the left dock, so dragging the right edge
 * outward widens them. Shared by the legend and the trade ranking so both resize
 * the same way and remember their size across sessions.
 */
export function useResizableWidth(storageKey: string, opts: ResizableWidthOptions) {
  const clamp = (value: number) => Math.min(opts.max, Math.max(opts.min, Math.round(value)))

  const read = (): number => {
    if (typeof window === 'undefined') return opts.default
    const raw = Number(window.localStorage.getItem(storageKey))
    return Number.isFinite(raw) && raw > 0 ? clamp(raw) : opts.default
  }

  const width = ref(read())
  let startX = 0
  let startWidth = 0

  function onMove(event: PointerEvent) {
    width.value = clamp(startWidth + (event.clientX - startX))
  }

  function onUp() {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(storageKey, String(width.value))
    }
  }

  function startResize(event: PointerEvent) {
    startX = event.clientX
    startWidth = width.value
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  onBeforeUnmount(() => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
  })

  return { width, startResize }
}
