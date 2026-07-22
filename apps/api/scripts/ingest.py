"""Run the F5b ingestion directly (no broker needed).

Fetches every enabled feed from the `ingest_sources` allowlist into
`raw_documents`. Run: `python -m scripts.ingest` (or `pnpm pipeline-ingest`).
For the worker path, dispatch `src.worker.tasks.pipeline_ingest` instead.
"""

from __future__ import annotations

import asyncio
import json

from src.ingest.service import ingest_all


def main() -> None:
    stats = asyncio.run(ingest_all())
    print(json.dumps(stats, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
