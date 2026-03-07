from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from typing import Callable, Dict

BACKEND_DIR = Path(__file__).resolve().parents[4]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

COLLECT_PATH = BACKEND_DIR / "app" / "agents" / "relevancy" / "tools_v2" / "collect.py"


def _load_collect_page_sources() -> Callable[[str, int], Dict[str, object]]:
    spec = importlib.util.spec_from_file_location("relevancy_tools_v2_collect", COLLECT_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load collect module from: {COLLECT_PATH}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.collect_page_sources


collect_page_sources = _load_collect_page_sources()


def _print_result(url: str) -> None:
    result = collect_page_sources(url)
    print(f"\nURL: {url}")
    print(f"method={result['fetch_method']} status={result['status_code']}")
    print(f"blocked={result['blocked']} reason={result['block_reason']} needs_browser={result.get('needs_browser', False)}")
    print(f"final_url={result['final_url']}")
    snippet = result["text_snippet"] or ""
    print(f"snippet={str(snippet)[:180]}")
    if result["errors"]:
        print(f"errors={result['errors']}")


def main() -> None:
    _print_result("https://example.com")
    _print_result("https://www.cloudflare.com")


if __name__ == "__main__":
    main()
