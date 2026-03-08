from __future__ import annotations

import re
from html import unescape
from typing import Any, Dict, List, Optional, Sequence, Tuple
from urllib.parse import urljoin, urlparse

try:
    from playwright.sync_api import Page, sync_playwright
except Exception:
    Page = Any  # type: ignore[assignment]
    sync_playwright = None

BLOCK_MARKERS: Tuple[Tuple[str, str], ...] = (
    ("turnstile", "turnstile"),
    ("cf-challenge", "cloudflare_challenge"),
    ("challenge-platform", "cloudflare_challenge"),
    ("cloudflare ray id", "cloudflare_challenge"),
    ("checking your browser", "checking_your_browser"),
    ("verify you are human", "bot_challenge"),
    ("are you human", "bot_challenge"),
    ("access denied", "access_denied"),
    ("captcha", "captcha"),
)
COOKIE_BUTTON_PATTERNS: Sequence[str] = (
    "accept all",
    "accept",
    "allow all",
    "accept cookies",
    "accept all cookies",
    "allow cookies",
    "agree",
    "i agree",
    "consent",
    "yes, i agree",
    "ok",
    "got it",
)
PRIORITY_LABEL_ORDER: Tuple[str, ...] = (
    "wholesale",
    "trade",
    "stockists",
    "retailers",
    "stores",
    "about",
    "contact",
    "faq",
    "shipping",
    "products",
    "shop",
    "collections",
    "category",
)
PRIORITY_ROUTE_PATTERNS: Dict[str, Tuple[str, ...]] = {
    "wholesale": (
        "/wholesale",
        " wholesale ",
        "grosshandel",
        "wiederverkaeufer",
        "reseller",
        "b2b",
    ),
    "trade": (
        "/trade",
        " trade ",
        "trade program",
        "trade account",
        "haendler",
        "fachhandel",
    ),
    "stockists": (
        "/stockist",
        "/stockists",
        "stockist",
        "stockists",
        "where to buy",
        "haendlerliste",
    ),
    "retailers": (
        "/retailer",
        "/retailers",
        "retailer",
        "retailers",
        "retail partner",
    ),
    "stores": (
        "/stores",
        "/store-locator",
        "/storefinder",
        "find a store",
        "store locator",
        "filialen",
        "geschaefte",
    ),
    "about": (
        "/about",
        "/about-us",
        "/our-story",
        " about ",
        "ueber-uns",
        "uber-uns",
    ),
    "contact": (
        "/contact",
        "/kontakt",
        "/support",
        " contact ",
        "kontakt",
    ),
    "faq": (
        "/faq",
        "/faqs",
        "/questions",
        " faq ",
        "frequently asked",
        "haeufige fragen",
    ),
    "shipping": (
        "/shipping",
        "/delivery",
        "/versand",
        "shipping",
        "delivery",
        "versand",
        "lieferung",
    ),
    "products": (
        "/products",
        "/product",
        "products",
        "produkt",
        "produkte",
    ),
    "shop": (
        "/shop",
        "/store",
        " shop ",
        "store",
        "einkaufen",
    ),
    "collections": (
        "/collections",
        "/collection",
        "collections",
        "kollektion",
        "kollektionen",
    ),
    "category": (
        "/category",
        "/categories",
        "/catalog",
        "category",
        "categories",
        "kategorie",
    ),
}
HEURISTIC_ROUTE_PATHS: Dict[str, Tuple[str, ...]] = {
    "wholesale": ("wholesale", "grosshandel", "b2b"),
    "trade": ("trade", "trade-program", "haendler"),
    "stockists": ("stockists", "stockist", "where-to-buy"),
    "retailers": ("retailers", "retailer", "retail-partners"),
    "stores": ("stores", "store-locator", "storefinder"),
    "about": ("about", "about-us", "ueber-uns"),
    "contact": ("contact", "kontakt", "support"),
    "faq": ("faq", "faqs", "haeufige-fragen"),
    "shipping": ("shipping", "delivery", "versand"),
    "products": ("products", "produkt", "produkte"),
    "shop": ("shop", "store", "einkaufen"),
    "collections": ("collections", "collection", "kollektionen"),
    "category": ("category", "categories", "kategorie"),
}
HIGH_VOLUME_LABELS = {"products", "shop", "collections", "category", "stores"}
SCRIPT_STYLE_RE = re.compile(r"(?is)<(script|style).*?>.*?</\1>")
TAG_RE = re.compile(r"(?s)<[^>]+>")
WS_RE = re.compile(r"\s+")


def _same_host(base_url: str, target_url: str) -> bool:
    base_host = (urlparse(base_url).netloc or "").lower().lstrip("www.")
    target_host = (urlparse(target_url).netloc or "").lower().lstrip("www.")
    return bool(base_host and target_host and base_host == target_host)


def _root_url(url: str) -> str:
    parsed = urlparse(url)
    if not parsed.scheme or not parsed.netloc:
        return url
    return f"{parsed.scheme}://{parsed.netloc}/"


def _normalize_internal_url(base_url: str, target_url: str) -> str:
    absolute = urljoin(base_url, target_url).split("#", 1)[0].strip()
    parsed = urlparse(absolute)
    if parsed.scheme not in {"http", "https"}:
        return ""
    path = parsed.path or "/"
    if path != "/":
        path = path.rstrip("/")
    query = f"?{parsed.query}" if parsed.query else ""
    return f"{parsed.scheme}://{parsed.netloc}{path}{query}"


def _clean_visible_text(value: str, limit: int) -> str:
    text = WS_RE.sub(" ", unescape(value or "")).strip()
    if len(text) <= limit:
        return text
    return text[:limit]


def _extract_text_from_html(html: str, limit: int = 1200) -> str:
    without_scripts = SCRIPT_STYLE_RE.sub(" ", html or "")
    no_tags = TAG_RE.sub(" ", without_scripts)
    return _clean_visible_text(no_tags, limit=limit)


def _detect_block(status_code: Optional[int], html: str, text_excerpt: str) -> Tuple[bool, Optional[str]]:
    if status_code in (403, 429):
        return True, f"http_{status_code}"
    lowered = f"{html}\n{text_excerpt}".lower()
    for keyword, reason in BLOCK_MARKERS:
        if keyword in lowered:
            return True, reason
    return False, None


def _wait_page_ready(page: Page, timeout_s: int) -> List[str]:
    diagnostics: List[str] = []
    wait_ms = max(1500, min(timeout_s * 1000, 12000))
    try:
        page.wait_for_load_state("networkidle", timeout=wait_ms)
    except Exception:
        diagnostics.append("wait=networkidle_timeout")
    page.wait_for_timeout(280)
    diagnostics.append("settle=280ms")
    return diagnostics


def _dismiss_cookie_banner(page: Page) -> List[str]:
    for pattern in COOKIE_BUTTON_PATTERNS:
        try:
            locator = page.get_by_role("button", name=re.compile(rf"^\s*{re.escape(pattern)}\s*$", re.IGNORECASE))
            if locator.count() == 0:
                raise RuntimeError("no_exact_button")
            locator.first.click(timeout=900)
            page.wait_for_timeout(120)
            return [f"cookie=exact:{pattern}"]
        except Exception:
            pass
        try:
            partial = page.get_by_role("button", name=re.compile(re.escape(pattern), re.IGNORECASE))
            if partial.count() == 0:
                continue
            partial.first.click(timeout=900)
            page.wait_for_timeout(120)
            return [f"cookie=partial:{pattern}"]
        except Exception:
            continue
    return []


def _visible_text_excerpt(page: Page, limit: int = 1800) -> str:
    try:
        body_text = page.locator("body").inner_text(timeout=1800)
        return _clean_visible_text(body_text, limit=limit)
    except Exception:
        return ""


def _label_priority(label: str) -> int:
    normalized = str(label or "").strip().lower()
    if normalized in PRIORITY_LABEL_ORDER:
        return PRIORITY_LABEL_ORDER.index(normalized)
    return len(PRIORITY_LABEL_ORDER) + 2


def _classify_priority_label(target_url: str, anchor_text: str) -> Tuple[str, int]:
    route_blob = f"{target_url.lower()} {anchor_text.lower()}"
    best_label = ""
    best_score = 0
    best_rank = len(PRIORITY_LABEL_ORDER) + 2

    for label in PRIORITY_LABEL_ORDER:
        tokens = PRIORITY_ROUTE_PATTERNS.get(label, ())
        token_hits = sum(1 for token in tokens if token and token in route_blob)
        if token_hits <= 0:
            continue
        rank = _label_priority(label)
        score = (token_hits * 10) + max(0, 18 - rank)
        if score > best_score or (score == best_score and rank < best_rank):
            best_label = label
            best_score = score
            best_rank = rank
    return best_label, best_score


def _extract_internal_links(page: Page, base_url: str) -> List[Dict[str, object]]:
    try:
        raw_links = page.eval_on_selector_all(
            "a[href]",
            """elements => elements.slice(0, 900).map(el => ({
                href: el.getAttribute("href") || "",
                text: (el.textContent || "").trim()
            }))""",
        )
    except Exception:
        raw_links = []

    links: List[Dict[str, object]] = []
    seen: set[str] = set()
    for item in raw_links:
        if not isinstance(item, dict):
            continue
        href = str(item.get("href") or "").strip()
        anchor = str(item.get("text") or "").strip()
        if not href or href.startswith(("javascript:", "mailto:", "tel:")):
            continue
        absolute = _normalize_internal_url(base_url, href)
        if not absolute:
            continue
        if not _same_host(base_url, absolute):
            continue
        normalized = absolute.rstrip("/")
        if not normalized or normalized in seen:
            continue
        label, score = _classify_priority_label(absolute, anchor)
        if not label:
            continue
        seen.add(normalized)
        links.append(
            {
                "label": label,
                "url": absolute,
                "anchor": anchor[:90],
                "score": score,
                "source": "discovered",
            }
        )

    links.sort(
        key=lambda item: (
            _label_priority(str(item.get("label") or "")),
            -int(item.get("score", 0)),
            len(str(item.get("url") or "")),
        )
    )
    return links[:28]


def _heuristic_route_candidates(base_url: str) -> List[Dict[str, object]]:
    root = _root_url(base_url)
    candidates: List[Dict[str, object]] = []
    for label in PRIORITY_LABEL_ORDER:
        for slug in HEURISTIC_ROUTE_PATHS.get(label, ()):
            target = _normalize_internal_url(root, f"/{slug.strip('/')}")
            if not target or not _same_host(root, target):
                continue
            candidates.append(
                {
                    "label": label,
                    "url": target,
                    "anchor": "",
                    "score": 3,
                    "source": "heuristic",
                }
            )
    return candidates


def _select_internal_targets(
    homepage_url: str,
    discovered_links: List[Dict[str, object]],
    max_internal_pages: int,
) -> List[Dict[str, object]]:
    limit = max(1, min(max_internal_pages, 8))
    homepage_key = homepage_url.rstrip("/")
    seen_urls: set[str] = {homepage_key}
    deduped: List[Dict[str, object]] = []

    for candidate in [*discovered_links, *_heuristic_route_candidates(homepage_url)]:
        if not isinstance(candidate, dict):
            continue
        target_url = str(candidate.get("url") or "").strip()
        if not target_url:
            continue
        normalized = target_url.rstrip("/")
        if not normalized or normalized in seen_urls:
            continue
        seen_urls.add(normalized)
        deduped.append(candidate)

    deduped.sort(
        key=lambda item: (
            _label_priority(str(item.get("label") or "")),
            0 if str(item.get("source") or "") == "discovered" else 1,
            -int(item.get("score", 0)),
            len(str(item.get("url") or "")),
        )
    )

    selected: List[Dict[str, object]] = []
    label_counts: Dict[str, int] = {}
    seen_selected: set[str] = set()

    for candidate in deduped:
        label = str(candidate.get("label") or "").strip().lower()
        url = str(candidate.get("url") or "").strip()
        if not label or not url or url in seen_selected:
            continue
        if label_counts.get(label, 0) > 0:
            continue
        selected.append(candidate)
        seen_selected.add(url)
        label_counts[label] = 1
        if len(selected) >= limit:
            return selected

    for candidate in deduped:
        label = str(candidate.get("label") or "").strip().lower()
        url = str(candidate.get("url") or "").strip()
        if not label or not url or url in seen_selected:
            continue
        cap = 2 if label in HIGH_VOLUME_LABELS else 1
        if label_counts.get(label, 0) >= cap:
            continue
        selected.append(candidate)
        seen_selected.add(url)
        label_counts[label] = label_counts.get(label, 0) + 1
        if len(selected) >= limit:
            break

    return selected


def _collect_page_with_browser(page: Page, requested_url: str, timeout_s: int) -> Dict[str, object]:
    page_diagnostics: List[str] = []
    response = None

    try:
        response = page.goto(requested_url, wait_until="domcontentloaded", timeout=max(timeout_s, 1) * 1000)
    except Exception as exc:
        return {
            "requested_url": requested_url,
            "final_url": requested_url,
            "status_code": None,
            "title": None,
            "rendered_title": None,
            "html": None,
            "text_snippet": None,
            "rendered_text_excerpt": None,
            "blocked": False,
            "block_reason": None,
            "page_diagnostics": [f"goto_failed={type(exc).__name__}"],
            "error": f"navigation:{type(exc).__name__}",
        }

    page_diagnostics.extend(_wait_page_ready(page, timeout_s))
    page_diagnostics.extend(_dismiss_cookie_banner(page))

    final_url = page.url or requested_url
    status_code = response.status if response is not None else None
    rendered_title = ""
    try:
        rendered_title = page.title() or ""
    except Exception:
        rendered_title = ""

    html = page.content() or ""
    rendered_excerpt = _visible_text_excerpt(page, limit=1800)
    if not rendered_excerpt:
        rendered_excerpt = _extract_text_from_html(html, limit=1200)
    text_excerpt = rendered_excerpt[:900] if rendered_excerpt else ""
    blocked, block_reason = _detect_block(status_code, html, text_excerpt)

    if isinstance(status_code, int):
        page_diagnostics.append(f"status={status_code}")
    if blocked and block_reason:
        page_diagnostics.append(f"blocked={block_reason}")

    return {
        "requested_url": requested_url,
        "final_url": final_url,
        "status_code": status_code,
        "title": rendered_title[:240] if rendered_title else None,
        "rendered_title": rendered_title[:240] if rendered_title else None,
        "html": html or None,
        "text_snippet": text_excerpt or None,
        "rendered_text_excerpt": rendered_excerpt[:1200] if rendered_excerpt else None,
        "blocked": blocked,
        "block_reason": block_reason,
        "page_diagnostics": page_diagnostics[:6],
        "error": None,
    }


def collect_with_playwright(
    url: str,
    timeout_s: int,
    user_agent: str,
    include_internal_pages: bool = False,
    max_internal_pages: int = 4,
) -> Dict[str, object]:
    if sync_playwright is None:
        raise RuntimeError("playwright is not installed")

    diagnostics: List[str] = ["path=browser", "session=reused"]
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--disable-infobars",
                "--window-size=1920,1080",
                "--no-sandbox",
                "--disable-setuid-sandbox",
            ],
        )
        context = browser.new_context(
            user_agent=user_agent,
            locale="en-US",
            viewport={"width": 1920, "height": 1080},
            device_scale_factor=1.0,
        )
        page = context.new_page()
        page.add_init_script("Object.defineProperty(navigator, 'webdriver', { get: () => undefined })")
        try:
            homepage = _collect_page_with_browser(page, url, timeout_s)
            homepage_url = str(homepage.get("final_url") or url)
            internal_links = _extract_internal_links(page, homepage_url)
            diagnostics.append(f"discovered={len(internal_links)}")

            visited_pages: List[Dict[str, object]] = []
            if include_internal_pages:
                targets = _select_internal_targets(homepage_url, internal_links, max_internal_pages=max_internal_pages)
                diagnostics.append(f"selected={len(targets)}")
                seen_urls: set[str] = {homepage_url.rstrip("/")}
                for target in targets:
                    target_url = str(target.get("url") or "").strip()
                    label = str(target.get("label") or "").strip().lower()[:40] or "page"
                    if not target_url:
                        continue
                    normalized_target = target_url.rstrip("/")
                    if normalized_target in seen_urls:
                        continue
                    page_result = _collect_page_with_browser(page, target_url, min(timeout_s, 12))
                    page_result["label"] = label
                    page_result["fetch_method"] = "playwright"
                    page_result["needs_browser"] = True
                    page_result["errors"] = []
                    page_result["source"] = str(target.get("source") or "discovered")
                    visited_pages.append(page_result)
                    seen_urls.add(normalized_target)
                    final_url = str(page_result.get("final_url") or "").rstrip("/")
                    if final_url:
                        seen_urls.add(final_url)
                    if len(visited_pages) >= max(1, min(max_internal_pages, 8)):
                        break
            diagnostics.append(f"visited={len(visited_pages)}")

            return {
                "homepage": homepage,
                "internal_links": internal_links[:24],
                "visited_pages": visited_pages[:8],
                "diagnostics": diagnostics[:12],
            }
        finally:
            context.close()
            browser.close()
