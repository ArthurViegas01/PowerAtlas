/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Base URL of the PowerAtlas API (F3). When set, the app loads data from
   * `${VITE_API_URL}/api/v1/power-data`; when absent, it stays fully offline
   * on the bundled mock dataset. See `services/dataSource.ts`.
   */
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
