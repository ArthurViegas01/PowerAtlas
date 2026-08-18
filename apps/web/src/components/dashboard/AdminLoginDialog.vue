<script setup lang="ts">
import { ref } from 'vue'

import { useAdminStore } from '@/stores/admin'

/**
 * Admin login: the operator enters the password to obtain a session token from
 * the API. Only then do the console's write tools (import/remove) appear. The
 * real guarantee is server-side (the API rejects writes without a valid token);
 * this dialog just unlocks the UI for the logged-in operator.
 */
const emit = defineEmits<{ (event: 'close'): void; (event: 'authenticated'): void }>()

const admin = useAdminStore()
const password = ref('')

async function submit() {
  if (!password.value || admin.busy) return
  const ok = await admin.login(password.value)
  password.value = ''
  if (ok) emit('authenticated')
}
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="dialog" role="dialog" aria-modal="true" aria-label="Entrar como administrador">
      <header class="dialog-head">
        <h2 class="pa-data dialog-title">ACESSO DE ADMINISTRADOR</h2>
        <button class="close pa-data" type="button" aria-label="Fechar" @click="emit('close')">
          [X]
        </button>
      </header>

      <div class="dialog-body">
        <p class="hint pa-label">
          Somente o administrador altera os dados. A senha vale uma sessão neste navegador.
        </p>
        <label class="field">
          <span class="pa-label">SENHA</span>
          <input
            v-model="password"
            class="text-input pa-data"
            type="password"
            autocomplete="current-password"
            placeholder="••••••••"
            @keyup.enter="submit"
          />
        </label>
        <p v-if="admin.error" class="msg msg-error pa-data">{{ admin.error }}</p>
      </div>

      <footer class="dialog-foot">
        <button class="action pa-data" type="button" @click="emit('close')">CANCELAR</button>
        <button
          class="action action-primary pa-data"
          type="button"
          :disabled="!password || admin.busy"
          @click="submit"
        >
          {{ admin.busy ? 'ENTRANDO…' : 'ENTRAR' }}
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(3, 6, 8, 0.72);
}

.dialog {
  display: flex;
  flex-direction: column;
  width: min(420px, 100%);
  background: var(--pa-bg-deep);
  border: 1px solid var(--pa-border-cyan);
  box-shadow: var(--pa-glow-cyan);
}

.dialog-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--pa-border-faint);
}

.dialog-title {
  margin: 0;
  font-size: var(--pa-text-md);
  letter-spacing: 0.12em;
  color: var(--pa-series-official);
}

.close {
  padding: 2px 6px;
  color: var(--pa-text-dim);
  background: none;
  border: 1px solid var(--pa-border-faint);
  cursor: pointer;
}

.dialog-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
}

.hint {
  margin: 0;
  color: var(--pa-text-dim);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.text-input {
  padding: 7px 10px;
  font-size: var(--pa-text-sm);
  letter-spacing: 0.2em;
  color: var(--pa-text-primary);
  background: var(--pa-bg-inset);
  border: 1px solid var(--pa-border-cyan);
}

.text-input:focus {
  outline: none;
  box-shadow: var(--pa-glow-cyan);
}

.msg {
  margin: 0;
  padding: 6px 10px;
  font-size: var(--pa-text-2xs);
  letter-spacing: 0.08em;
}

.msg-error {
  color: var(--pa-danger);
  border: 1px solid color-mix(in srgb, var(--pa-danger) 40%, transparent);
  background: color-mix(in srgb, var(--pa-danger) 8%, transparent);
}

.dialog-foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--pa-border-faint);
}

.action {
  padding: 7px 14px;
  font-size: var(--pa-text-2xs);
  letter-spacing: 0.12em;
  color: var(--pa-text-dim);
  background: transparent;
  border: 1px solid var(--pa-border-faint);
  cursor: pointer;
}

.action-primary {
  color: var(--pa-series-official);
  border-color: var(--pa-border-cyan);
}

.action-primary:hover:not(:disabled) {
  box-shadow: var(--pa-glow-cyan);
}

.action:disabled {
  color: var(--pa-text-faint);
  cursor: default;
}
</style>
