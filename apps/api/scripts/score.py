"""Run the heuristic scoring v0 directly (no broker, no AI keys).

Turns the ingested raw_documents into DRAFT ranking candidates with
citations (src/scoring/score_v0.py). Run: `python -m scripts.score`
(or `pnpm pipeline-score`). The served payload is untouched by design.
"""

from __future__ import annotations

import asyncio
import json

from src.scoring.score_v0 import run_scoring


def main() -> None:
    stats = asyncio.run(run_scoring())
    print(json.dumps(stats, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
