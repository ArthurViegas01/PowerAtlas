/** One ingested headline from the F5 allowlisted institutional feeds. */
export interface MonitoringDocument {
  id: number
  sourceId: string
  sourceName: string
  title: string
  url: string
  publishedAt: string | null
}
