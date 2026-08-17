import { onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { fromQuery, toQuery } from '@/lib/analysisUrl'
import { useAnalysisStore } from '@/stores/analysis'

/**
 * Two-way bridge between the analysis state and the URL (IA-3), called once
 * from App.vue. On boot it applies whatever the query string describes (the
 * old /?region= deep link included); afterwards it mirrors every state change
 * back into the query via router.replace, debounced, so the address bar is
 * always a shareable snapshot. MapScreen's own region deep-link still runs;
 * both apply the same selection, so the duplication is a harmless no-op.
 */
export function useAnalysisSync() {
  const route = useRoute()
  const router = useRouter()
  const analysis = useAnalysisStore()

  let booted = false
  let timer: number | undefined

  onMounted(() => {
    // The initial navigation resolves async: without isReady() the query is
    // still empty at mount and the replay would silently apply nothing.
    void router
      .isReady()
      .then(() => analysis.apply(fromQuery(route.query)))
      .finally(() => {
        booted = true
      })
  })

  watch(
    () => JSON.stringify(toQuery(analysis.snapshot())),
    (serialized) => {
      if (!booted || route.path !== '/') return
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        const query = JSON.parse(serialized) as Record<string, string>
        const current = new URLSearchParams(
          Object.entries(route.query).flatMap(([key, value]) =>
            typeof value === 'string' ? [[key, value] as [string, string]] : [],
          ),
        )
        if (new URLSearchParams(query).toString() === current.toString()) return
        void router.replace({ query })
      }, 250)
    },
  )
}
