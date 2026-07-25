<script setup lang="ts">
import { computed, ref } from 'vue'

import { formatCell } from '@/lib/datasets'
import { parseCsvDataset } from '@/lib/csv'
import { useImportedDatasetsStore } from '@/stores/importedDatasets'
import type { CellValue, DatasetColumn } from '@/types/dataset'

/**
 * CSV import dialog: pick a file, preview the inferred columns and first rows,
 * name it, confirm. The upload targets the isolated `datasets` namespace; it
 * never touches the served power data.
 */
const MAX_ROWS = 20000
const MAX_COLUMNS = 40

const emit = defineEmits<{ (event: 'close'): void; (event: 'imported', id: string): void }>()

const store = useImportedDatasetsStore()

const name = ref('')
const columns = ref<DatasetColumn[]>([])
const rows = ref<Record<string, CellValue>[]>([])
const fileName = ref('')
const parseError = ref<string | null>(null)
const submitError = ref<string | null>(null)
const submitting = ref(false)

const preview = computed(() => rows.value.slice(0, 8))
const tooManyRows = computed(() => rows.value.length > MAX_ROWS)
const tooManyColumns = computed(() => columns.value.length > MAX_COLUMNS)
const canSubmit = computed(
  () =>
    !submitting.value &&
    name.value.trim() !== '' &&
    rows.value.length > 0 &&
    !tooManyRows.value &&
    !tooManyColumns.value,
)

async function onFile(event: Event) {
  parseError.value = null
  submitError.value = null
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  fileName.value = file.name
  if (!name.value) name.value = file.name.replace(/\.[^.]+$/, '')
  try {
    const parsed = parseCsvDataset(await file.text())
    if (parsed.columns.length === 0 || parsed.rows.length === 0) {
      parseError.value = 'CSV vazio ou sem linhas de dados.'
      columns.value = []
      rows.value = []
      return
    }
    columns.value = parsed.columns
    rows.value = parsed.rows
  } catch (cause) {
    parseError.value = cause instanceof Error ? cause.message : String(cause)
  }
}

async function submit() {
  if (!canSubmit.value) return
  submitting.value = true
  submitError.value = null
  try {
    const meta = await store.importCsv({
      name: name.value.trim(),
      source: 'IMPORTADO',
      columns: columns.value,
      rows: rows.value,
    })
    emit('imported', meta.id)
  } catch (cause) {
    submitError.value = cause instanceof Error ? cause.message : String(cause)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="dialog" role="dialog" aria-modal="true" aria-label="Importar dataset">
      <header class="dialog-head">
        <h2 class="pa-data dialog-title">IMPORTAR DATASET (CSV)</h2>
        <button class="close pa-data" type="button" aria-label="Fechar" @click="emit('close')">
          [X]
        </button>
      </header>

      <div class="dialog-body">
        <label class="field">
          <span class="pa-label">ARQUIVO CSV</span>
          <input class="file-input pa-data" type="file" accept=".csv,text/csv" @change="onFile" />
        </label>

        <p v-if="parseError" class="msg msg-error pa-data">{{ parseError }}</p>

        <template v-if="columns.length">
          <label class="field">
            <span class="pa-label">NOME DO DATASET</span>
            <input v-model="name" class="text-input pa-data" type="text" placeholder="NOME" />
          </label>

          <p class="pa-label meta-line">
            {{ rows.length }} LINHAS · {{ columns.length }} COLUNAS ·
            {{ columns.filter((c) => c.numeric).length }} NUMÉRICAS · FONTE {{ fileName }}
          </p>

          <p v-if="tooManyRows" class="msg msg-error pa-data">
            LIMITE DE {{ MAX_ROWS }} LINHAS EXCEDIDO
          </p>
          <p v-if="tooManyColumns" class="msg msg-error pa-data">
            LIMITE DE {{ MAX_COLUMNS }} COLUNAS EXCEDIDO
          </p>

          <div class="preview-scroll">
            <table class="pa-data preview-table">
              <thead>
                <tr>
                  <th v-for="col in columns" :key="col.key" :class="{ 'is-num': col.numeric }">
                    {{ col.label }}<span class="col-type">{{ col.numeric ? '#' : 'A' }}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, i) in preview" :key="i">
                  <td v-for="col in columns" :key="col.key" :class="{ 'is-num': col.numeric }">
                    {{ formatCell(col, row[col.key] ?? null) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>

        <p v-if="submitError" class="msg msg-error pa-data">{{ submitError }}</p>
      </div>

      <footer class="dialog-foot">
        <button class="action pa-data" type="button" @click="emit('close')">CANCELAR</button>
        <button class="action action-primary pa-data" type="button" :disabled="!canSubmit" @click="submit">
          {{ submitting ? 'IMPORTANDO…' : 'IMPORTAR' }}
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
  width: min(720px, 100%);
  max-height: 86vh;
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
  overflow-y: auto;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.file-input,
.text-input {
  padding: 7px 10px;
  font-size: var(--pa-text-xs);
  color: var(--pa-text-primary);
  background: var(--pa-bg-inset);
  border: 1px solid var(--pa-border-cyan);
}

.text-input:focus,
.file-input:focus {
  outline: none;
  box-shadow: var(--pa-glow-cyan);
}

.meta-line {
  margin: 0;
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

.preview-scroll {
  overflow: auto;
  max-height: 34vh;
  border: 1px solid var(--pa-border-faint);
}

.preview-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--pa-text-2xs);
}

.preview-table th {
  position: sticky;
  top: 0;
  padding: 6px 10px;
  text-align: left;
  white-space: nowrap;
  color: var(--pa-text-dim);
  background: var(--pa-bg-deep);
  border-bottom: 1px solid var(--pa-border-cyan);
}

.col-type {
  margin-left: 5px;
  color: var(--pa-text-faint);
}

.preview-table td {
  padding: 4px 10px;
  white-space: nowrap;
  color: var(--pa-text-primary);
  border-bottom: 1px solid var(--pa-border-faint);
}

.preview-table .is-num {
  text-align: right;
  font-variant-numeric: tabular-nums;
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
