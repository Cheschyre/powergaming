"""Write the API's OpenAPI schema to a file (default: stdout).

The frontend's TypeScript types are generated from this -- see
scripts/gen-api-types.sh at the repo root. Importing the app doesn't touch
the database, so this runs without Postgres.

    python scripts/export_openapi.py ../frontend/openapi.json
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.main import app  # noqa: E402


def main() -> None:
    text = json.dumps(app.openapi(), indent=2, sort_keys=True) + "\n"
    if len(sys.argv) > 1:
        Path(sys.argv[1]).write_text(text)
    else:
        sys.stdout.write(text)


if __name__ == "__main__":
    main()
