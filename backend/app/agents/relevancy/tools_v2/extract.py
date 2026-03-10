from __future__ import annotations

import re
from typing import Any, Dict, List, Set

import extruct
import trafilatura
from w3lib.html import get_base_url

from app.agents.relevancy.schemas import (
    CleanTextOutput,
    StructuredEntity,
    StructuredSignalsOutput,
)
from app.agents.relevancy.state import RelevancyAgentState
from app.agents.relevancy.tools_v2.collect import collect_page_sources

OG_PRODUCT_RE = re.compile(
    r'<meta[^>]+property=["\']og:type["\'][^>]+content=["\']([^"\']+)["\']',
    re.IGNORECASE,
)
META_GENERATOR_RE = re.compile(
    r'<meta[^>]+name=["\']generator["\'][^>]+content=["\']([^"\']+)["\']',
    re.IGNORECASE,
)
WS_RE = re.compile(r"\s+")


def _pages_from_state(state: RelevancyAgentState) -> List[Dict[str, Any]]:
    collect = state.get("collect_sources_output") or {}
    homepage = collect.get("homepage")
    pages = collect.get("pages") or []
    combined: List[Dict[str, Any]] = []
    if homepage:
        combined.append(homepage)
    combined.extend(pages)
    return combined


def _first_scalar_string(value: Any) -> str | None:
    if value is None:
        return None

    if isinstance(value, str):
        value = WS_RE.sub(" ", value).strip()
        return value or None

    if isinstance(value, (list, tuple, set)):
        for item in value:
            normalized = _first_scalar_string(item)
            if normalized:
                return normalized
        return None

    if isinstance(value, dict):
        # Sometimes nested structured fields appear like {"@id": "..."} or {"url": "..."}
        for key in ("@id", "url", "name", "headline", "title"):
            if key in value:
                normalized = _first_scalar_string(value.get(key))
                if normalized:
                    return normalized
        return None

    try:
        text = WS_RE.sub(" ", str(value)).strip()
        return text or None
    except Exception:
        return None


def _normalized_keys(item: Dict[str, Any]) -> List[str]:
    keys: List[str] = []
    for key in item.keys():
        text = _first_scalar_string(key)
        if text:
            keys.append(text[:80])
    return keys[:18]


def _extract_structured_entities(html: str, url: str) -> List[StructuredEntity]:
    try:
        data = extruct.extract(
            html,
            base_url=get_base_url(html, url),
            syntaxes=["json-ld", "microdata", "rdfa"],
            errors="ignore",
            uniform=True,
        )
    except Exception:
        return []

    entities: List[StructuredEntity] = []
    syntax_map = [("json-ld", "json-ld"), ("microdata", "microdata"), ("rdfa", "rdfa")]

    for key, source in syntax_map:
        items = data.get(key) or []
        for item in items[:12]:
            if not isinstance(item, dict):
                continue

            raw_type_hint = item.get("@type") or item.get("type")
            if isinstance(raw_type_hint, list):
                type_hint = ", ".join(
                    str(x).strip() for x in raw_type_hint[:3] if str(x).strip()
                ) or None
            else:
                type_hint = _first_scalar_string(raw_type_hint)

            raw_name = item.get("name") or item.get("headline") or item.get("title")
            raw_url = item.get("url")

            name = _first_scalar_string(raw_name)
            item_url = _first_scalar_string(raw_url)
            keys = _normalized_keys(item)

            try:
                entities.append(
                    StructuredEntity(
                        source=source,
                        type_hint=type_hint,
                        name=name,
                        url=item_url,
                        keys=keys,
                    )
                )
            except Exception:
                # Skip malformed entity instead of crashing the whole pipeline
                continue

    return entities[:30]


def _normalized_text_key(value: str, max_len: int = 220) -> str:
    return WS_RE.sub(" ", str(value or "").strip().lower())[:max_len]


def _is_weak_clean_text(value: str) -> bool:
    trimmed = str(value or "").strip()
    if not trimmed:
        return True
    words = trimmed.split()
    return len(trimmed) < 180 or len(words) < 32


def _is_very_short_clean_text(value: str) -> bool:
    trimmed = str(value or "").strip()
    if not trimmed:
        return True
    words = trimmed.split()
    return len(trimmed) < 90 or len(words) < 16


def _preferred_page_excerpt(page: Dict[str, Any]) -> str:
    rendered = str(page.get("rendered_text_excerpt") or "").strip()
    if rendered:
        return rendered
    return str(page.get("text_excerpt") or "").strip()


def _put_section(sections: Dict[str, str], label: str, content: str) -> None:
    if not content:
        return
    content_key = _normalized_text_key(content, max_len=320)
    for existing in sections.values():
        if _normalized_text_key(existing, max_len=320) == content_key:
            return
    base = (str(label or "page").strip().lower() or "page")[:40]
    key = base
    if key in sections and sections[key] == content:
        return
    index = 2
    while key in sections and sections[key] != content:
        suffix = f"_{index}"
        key = f"{base[: max(1, 40 - len(suffix))]}{suffix}"
        index += 1
    sections[key] = content


def _maybe_refetch_full_html(page: Dict[str, Any], state: RelevancyAgentState) -> str:
    if page.get("html_truncated") is not True:
        return ""

    target_url = page.get("final_url") or page.get("requested_url") or state.get("website") or ""
    if not isinstance(target_url, str) or not target_url:
        return ""

    try:
        result = collect_page_sources(target_url, timeout_s=15)
    except Exception:
        return ""

    html = result.get("html")
    if isinstance(html, str) and html.strip():
        return html
    return ""


def _entity_keys(entity: StructuredEntity) -> Set[str]:
    return {str(key).strip().lower() for key in entity.keys if str(key).strip()}


def _extract_meta_signal_tags(html: str) -> Set[str]:
    tags: Set[str] = set()
    lowered = html.lower()

    og_matches = OG_PRODUCT_RE.findall(html)
    if any("product" in value.lower() for value in og_matches):
        tags.add("opengraph")

    generator_matches = META_GENERATOR_RE.findall(html)
    if any("shopify" in value.lower() for value in generator_matches):
        tags.add("meta_generator")

    if "property=\"og:" in lowered or "property='og:" in lowered:
        tags.add("opengraph")
    return tags


def _collect_structured_summary(entities: List[StructuredEntity], meta_tags: Set[str]) -> Dict[str, object]:
    flags: Set[str] = set()
    structured_signals_used: Set[str] = set(meta_tags)
    has_product_catalog = False
    has_organization = False
    has_product_signal = False

    for entity in entities:
        type_hint = (entity.type_hint or "").lower()
        keys = _entity_keys(entity)
        is_jsonld = entity.source == "json-ld"

        if not is_jsonld:
            continue

        has_product_or_offer_type = any(
            token in type_hint for token in ("product", "offer", "itemlist", "offercatalog")
        )
        has_product_or_offer_keys = any(token in keys for token in ("offers", "itemlistelement", "sku", "price"))
        if has_product_or_offer_type or has_product_or_offer_keys:
            flags.add("jsonld_products")
            structured_signals_used.add("jsonld_product")
            has_product_signal = True

        if ("organization" in type_hint or "localbusiness" in type_hint) and (
            bool(entity.name) or bool(entity.url) or "sameas" in keys
        ):
            flags.add("jsonld_org")
            structured_signals_used.add("jsonld_org")
            has_organization = True

        has_catalog_type = any(token in type_hint for token in ("itemlist", "collectionpage", "offercatalog"))
        has_catalog_keys = any(token in keys for token in ("itemlistelement", "numberofitems", "itemlistorder"))
        if has_catalog_type or has_catalog_keys:
            flags.add("jsonld_catalog")
            structured_signals_used.add("jsonld_catalog")
            has_product_catalog = True

    if has_product_catalog and (has_product_signal or has_organization):
        signal_strength = "strong"
    elif structured_signals_used or flags:
        signal_strength = "weak"
    else:
        signal_strength = "none"

    quality = "empty" if signal_strength == "none" else signal_strength
    return {
        "signal_flags": sorted(flags),
        "structured_signals_used": sorted(structured_signals_used),
        "structured_has_product_catalog": has_product_catalog,
        "structured_has_organization": has_organization,
        "structured_signal_strength": signal_strength,
        "quality": quality,
        "strong_signal": signal_strength == "strong",
    }


def extract_structured_signals(state: RelevancyAgentState) -> Dict[str, object]:
    entities: List[StructuredEntity] = []
    meta_signal_tags: Set[str] = set()
    for page in _pages_from_state(state):
        html = page.get("html") or ""
        url = page.get("final_url") or page.get("requested_url") or state.get("website") or ""
        if not html or not url:
            continue

        meta_signal_tags.update(_extract_meta_signal_tags(html))
        extracted = _extract_structured_entities(html, url)
        if not extracted:
            refetched_html = _maybe_refetch_full_html(page, state)
            if refetched_html:
                meta_signal_tags.update(_extract_meta_signal_tags(refetched_html))
                extracted = _extract_structured_entities(refetched_html, url)

        entities.extend(extracted)
        if len(entities) >= 30:
            break

    counts = {"json-ld": 0, "microdata": 0, "rdfa": 0}
    for entity in entities:
        counts[entity.source] = counts.get(entity.source, 0) + 1

    summary = _collect_structured_summary(entities[:30], meta_signal_tags)
    signal_flags = summary["signal_flags"]
    structured_signals_used = summary["structured_signals_used"]
    structured_has_product_catalog = bool(summary["structured_has_product_catalog"])
    structured_has_organization = bool(summary["structured_has_organization"])
    structured_signal_strength = str(summary["structured_signal_strength"])
    strong_signal = bool(summary["strong_signal"])
    quality = str(summary["quality"])

    output = StructuredSignalsOutput(
        entities=entities[:30],
        counts=counts,
        signal_flags=signal_flags,
        strong_signal=strong_signal,
        quality=quality,
        structured_has_product_catalog=structured_has_product_catalog,
        structured_has_organization=structured_has_organization,
        structured_signal_strength=structured_signal_strength,
        structured_signals_used=structured_signals_used,
    )
    return {
        "structured_signals_output": output.model_dump(),
        "structured_has_product_catalog": structured_has_product_catalog,
        "structured_has_organization": structured_has_organization,
        "structured_signal_strength": structured_signal_strength,
        "structured_signals_used": structured_signals_used,
    }


def extract_clean_text_and_sections(state: RelevancyAgentState) -> Dict[str, object]:
    chunks: List[str] = []
    sections: Dict[str, str] = {}
    seen_chunk_keys: Set[str] = set()

    for page in _pages_from_state(state):
        label = page.get("label") or "page"
        html = page.get("html") or ""
        fallback_excerpt = _preferred_page_excerpt(page)
        chosen_text = ""

        if html:
            clean_text = trafilatura.extract(
                html,
                include_comments=False,
                include_links=False,
                favor_recall=False,
                deduplicate=True,
            )
            if clean_text:
                trimmed = clean_text.strip()
                if trimmed:
                    # Prefer rendered browser text when parser output is weak or very short.
                    if fallback_excerpt and (_is_weak_clean_text(trimmed) or _is_very_short_clean_text(trimmed)):
                        chosen_text = fallback_excerpt
                    else:
                        chosen_text = trimmed
        if not chosen_text and fallback_excerpt:
            chosen_text = fallback_excerpt
        if not chosen_text:
            continue

        chunk_text = chosen_text[:900]
        dedupe_key = _normalized_text_key(chunk_text)
        if dedupe_key in seen_chunk_keys:
            continue
        seen_chunk_keys.add(dedupe_key)

        _put_section(sections, str(label), chosen_text[:500])
        chunks.append(chunk_text)
        if len(chunks) >= 8:
            break

    excerpt = "\n\n".join(chunks)[:2500]
    output = CleanTextOutput(text_excerpt=excerpt, sections=sections)
    return {"clean_text_output": output.model_dump()}
