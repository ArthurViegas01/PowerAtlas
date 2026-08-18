import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { login as apiLogin, setAuthToken } from '@/services/apiClient'
import { usingApi } from '@/services/dataSource'

const TOKEN_KEY = 'pa.admin.token'
const EXP_KEY = 'pa.admin.exp'

/** Read a persisted session (sessionStorage: cleared when the tab closes). */
function restore(): { token: string; expiresAt: number } | null {
  try {
    const token = sessionStorage.getItem(TOKEN_KEY)
    const exp = Number(sessionStorage.getItem(EXP_KEY))
    if (token && exp > Date.now() / 1000) return { token, expiresAt: exp }
  } catch {
    /* storage unavailable */
  }
  return null
}

/**
 * Admin session for the data console's write tools. The token is obtained from
 * the API (`POST /auth/login`) and required by every import/delete, so only the
 * logged-in operator can mutate. Persisted in sessionStorage so a reload within
 * the tab keeps the session; gone when the tab closes.
 *
 * Writes are only ever possible against a backend that has an admin configured
 * (PA_ADMIN_PASSWORD): a public deploy with no such backend is read-only.
 */
export const useAdminStore = defineStore('admin', () => {
  const restored = restore()
  const token = ref<string | null>(restored?.token ?? null)
  const expiresAt = ref<number | null>(restored?.expiresAt ?? null)
  const error = ref<string | null>(null)
  const busy = ref(false)

  if (restored) setAuthToken(restored.token)

  /** Logged in with a still-valid token. */
  const isAdmin = computed(
    () => token.value != null && expiresAt.value != null && expiresAt.value > Date.now() / 1000,
  )

  /** Only offer admin when a backend that can accept writes is reachable. */
  const canAuthenticate = usingApi

  async function login(password: string): Promise<boolean> {
    error.value = null
    busy.value = true
    try {
      const { token: t, expiresAt: exp } = await apiLogin(password)
      token.value = t
      expiresAt.value = exp
      setAuthToken(t)
      try {
        sessionStorage.setItem(TOKEN_KEY, t)
        sessionStorage.setItem(EXP_KEY, String(exp))
      } catch {
        /* storage unavailable; session stays in memory */
      }
      return true
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause)
      return false
    } finally {
      busy.value = false
    }
  }

  function logout(): void {
    token.value = null
    expiresAt.value = null
    error.value = null
    setAuthToken(null)
    try {
      sessionStorage.removeItem(TOKEN_KEY)
      sessionStorage.removeItem(EXP_KEY)
    } catch {
      /* storage unavailable */
    }
  }

  return { token, expiresAt, error, busy, isAdmin, canAuthenticate, login, logout }
})
