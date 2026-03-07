from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


def _clip(value: Optional[str], limit: int) -> Optional[str]:
    if value is None:
        return None
    value = value.strip()
    if len(value) <= limit:
        return value
    return value[: limit - 3] + "..."


class CompactModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class PageSource(CompactModel):
    label: str = Field(..., min_length=1, max_length=40)
    requested_url: str = Field(..., min_length=1, max_length=2048)
    final_url: Optional[str] = Field(default=None, max_length=2048)
    fetched: bool = False
    status_code: Optional[int] = Field(default=None, ge=100, le=599)
    title: Optional[str] = Field(default=None, max_length=240)
    content_type: Optional[str] = Field(default=None, max_length=100)
    html: Optional[str] = Field(default=None, max_length=40000)
    html_len: Optional[int] = Field(default=None, ge=0)
    html_truncated: Optional[bool] = False
    error: Optional[str] = Field(default=None, max_length=300)

    @field_validator("title")
    @classmethod
    def _cap_title(cls, value: Optional[str]) -> Optional[str]:
        return _clip(value, 240)

    @field_validator("html")
    @classmethod
    def _cap_html(cls, value: Optional[str]) -> Optional[str]:
        return _clip(value, 40000)

    @field_validator("error")
    @classmethod
    def _cap_error(cls, value: Optional[str]) -> Optional[str]:
        return _clip(value, 300)


class CollectPageSourcesOutput(CompactModel):
    website_exists: bool
    normalized_website: Optional[str] = Field(default=None, max_length=2048)
    homepage: Optional[PageSource] = None
    pages: List[PageSource] = Field(default_factory=list, max_length=8)
    errors: List[str] = Field(default_factory=list, max_length=12)

    @field_validator("errors", mode="before")
    @classmethod
    def _trim_errors(cls, value: Any) -> List[str]:
        values = value or []
        return [_clip(str(v), 200) or "" for v in list(values)[:12]]


class PlatformDetectionOutput(CompactModel):
    platform: Literal["shopify", "woocommerce", "wordpress", "custom", "unknown"]
    confidence: float = Field(..., ge=0.0, le=1.0)
    shopify_detected: bool = False
    reasons: List[str] = Field(default_factory=list, max_length=8)

    @field_validator("reasons", mode="before")
    @classmethod
    def _trim_reasons(cls, value: Any) -> List[str]:
        values = value or []
        return [_clip(str(v), 140) or "" for v in list(values)[:8]]


class ShopifyProbeOutput(CompactModel):
    performed: bool = True
    detected: bool = False
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    signals: List[str] = Field(default_factory=list, max_length=10)

    @field_validator("signals", mode="before")
    @classmethod
    def _trim_signals(cls, value: Any) -> List[str]:
        values = value or []
        return [_clip(str(v), 140) or "" for v in list(values)[:10]]


class StructuredEntity(CompactModel):
    source: Literal["json-ld", "microdata", "rdfa"]
    type_hint: Optional[str] = Field(default=None, max_length=120)
    name: Optional[str] = Field(default=None, max_length=180)
    url: Optional[str] = Field(default=None, max_length=2048)
    keys: List[str] = Field(default_factory=list, max_length=18)

    @field_validator("keys", mode="before")
    @classmethod
    def _trim_keys(cls, value: Any) -> List[str]:
        values = value or []
        return [_clip(str(v), 80) or "" for v in list(values)[:18]]


class StructuredSignalsOutput(CompactModel):
    entities: List[StructuredEntity] = Field(default_factory=list, max_length=30)
    counts: Dict[str, int] = Field(default_factory=dict)
    signal_flags: List[str] = Field(default_factory=list, max_length=12)
    strong_signal: bool = False
    quality: Literal["empty", "weak", "strong"] = "empty"
    structured_has_product_catalog: bool = False
    structured_has_organization: bool = False
    structured_signal_strength: Literal["none", "weak", "strong"] = "none"
    structured_signals_used: List[str] = Field(default_factory=list, max_length=12)

    @field_validator("signal_flags", mode="before")
    @classmethod
    def _trim_signal_flags(cls, value: Any) -> List[str]:
        values = value or []
        return [_clip(str(v), 60) or "" for v in list(values)[:12]]

    @field_validator("structured_signals_used", mode="before")
    @classmethod
    def _trim_structured_signals_used(cls, value: Any) -> List[str]:
        values = value or []
        return [_clip(str(v), 80) or "" for v in list(values)[:12]]


class CleanTextOutput(CompactModel):
    text_excerpt: str = Field(default="", max_length=2500)
    sections: Dict[str, str] = Field(default_factory=dict)

    @field_validator("text_excerpt")
    @classmethod
    def _cap_excerpt(cls, value: str) -> str:
        return _clip(value, 2500) or ""

    @field_validator("sections", mode="before")
    @classmethod
    def _cap_sections(cls, value: Any) -> Dict[str, str]:
        data = value or {}
        compact: Dict[str, str] = {}
        for key, text in list(data.items())[:8]:
            compact[_clip(str(key), 40) or "section"] = _clip(str(text), 500) or ""
        return compact


class LLMRelevanceDecision(CompactModel):
    relevance_decision: Literal["relevant", "irrelevant", "unknown"]
    manual_review: bool = False
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    match_reasons: List[str] = Field(default_factory=list, max_length=8)
    mismatch_reasons: List[str] = Field(default_factory=list, max_length=8)
    signals_used: List[str] = Field(default_factory=list, max_length=12)
    relevance_score: int = Field(..., ge=0, le=100)
    relevance_reason: str = Field(..., min_length=1, max_length=600)
    business_type: str = Field(default="Unknown", max_length=120)
    primary_niche: str = Field(default="Unknown", max_length=120)

    @field_validator("match_reasons", "mismatch_reasons", mode="before")
    @classmethod
    def _trim_reasons(cls, value: Any) -> List[str]:
        values = value or []
        return [_clip(str(v), 180) or "" for v in list(values)[:8]]

    @field_validator("signals_used", mode="before")
    @classmethod
    def _trim_signals_used(cls, value: Any) -> List[str]:
        values = value or []
        return [_clip(str(v), 80) or "" for v in list(values)[:12]]

    @field_validator("relevance_reason")
    @classmethod
    def _cap_reason(cls, value: str) -> str:
        return _clip(value, 600) or "No reason provided."

    @model_validator(mode="after")
    def _validate_unknown_requires_manual_review(self) -> "LLMRelevanceDecision":
        if self.relevance_decision == "unknown" and self.manual_review is not True:
            raise ValueError("manual_review must be true when relevance_decision is unknown")
        return self
