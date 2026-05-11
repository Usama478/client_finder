from __future__ import annotations

from langgraph.graph import END, StateGraph

from app.agents.verification import nodes as _nodes
from app.agents.verification.state import VerificationAgentState


# ------------------------------------------------------------------ #
# Routing                                                             #
# ------------------------------------------------------------------ #

def _route_after_gatekeeper(state: VerificationAgentState) -> str:
    """
    Route after the gatekeeper (site_accessibility_check) node.

    Only truly dead sites (website_alive=False AND NOT bot-blocked) skip the full
    evidence pipeline.  Bot-blocked / Cloudflare-protected sites continue to
    site_collector so that the Playwright fallback inside collect_pages() can
    still retrieve content.  This ensures:
    - Blocked brands are never silently marked failed.
    - email_context_compiler always sees a real verification_score (never None)
      because final_contract_builder runs before it on every path.
    """
    if state.get("website_alive") is False and state.get("collection_blocked") is not True:
        return "dead_site_handler"
    return "site_collector"


# ------------------------------------------------------------------ #
# Graph assembly — 10 nodes                                          #
# ------------------------------------------------------------------ #

workflow = StateGraph(VerificationAgentState)

# Lambda wrappers ensure pytest patching of _nodes.* works correctly
workflow.add_node("input_preparation",         lambda s: _nodes.input_preparation(s))
workflow.add_node("gatekeeper",                lambda s: _nodes.site_accessibility_check(s))
workflow.add_node("site_collector",            lambda s: _nodes.targeted_page_collector(s))
workflow.add_node("identity_resolver",         lambda s: _nodes.identity_resolver(s))
workflow.add_node("contact_extractor",         lambda s: _nodes.contact_extractor(s))
workflow.add_node("legitimacy_analyzer",       lambda s: _nodes.legitimacy_analyzer(s))
workflow.add_node("product_catalog_extractor", lambda s: _nodes.product_catalog_extractor(s))
workflow.add_node("size_estimator",            lambda s: _nodes.size_estimator(s))
workflow.add_node("llm_analyst",               lambda s: _nodes.business_intelligence_extractor(s))
workflow.add_node("metric_analyst",            lambda s: _nodes.email_context_compiler(s))
workflow.add_node("final_contract_builder",    lambda s: _nodes.final_contract_builder(s))
workflow.add_node("dead_site_handler", lambda s: {
    "verification_result": "manual_review",
    "verification_score": 0,
    "verification_confidence": 0.0,
    "verification_reason": "Website unreachable — manual review required",
    "manual_review": True,
    "is_finalized": True,
})

# --- Entry ---
workflow.set_entry_point("input_preparation")

# --- Linear: input_preparation → gatekeeper ---
workflow.add_edge("input_preparation", "gatekeeper")
workflow.add_edge("dead_site_handler", "final_contract_builder")

# --- Branch: alive sites → full pipeline; dead sites → email_context_compiler ---
workflow.add_conditional_edges(
    "gatekeeper",
    _route_after_gatekeeper,
    {
        "site_collector":    "site_collector",
        "dead_site_handler": "dead_site_handler",
    },
)

# --- Happy path: full evidence pipeline ---
workflow.add_edge("site_collector",           "identity_resolver")
workflow.add_edge("identity_resolver",        "contact_extractor")
workflow.add_edge("contact_extractor",        "legitimacy_analyzer")
workflow.add_edge("legitimacy_analyzer",      "product_catalog_extractor")
workflow.add_edge("product_catalog_extractor", "size_estimator")
workflow.add_edge("size_estimator",           "llm_analyst")
workflow.add_edge("llm_analyst",              "final_contract_builder")

# --- Both paths converge at final_contract_builder → metric_analyst → END ---
# final_contract_builder must run before metric_analyst so that
# verification_score, verification_result, contactability_score, and
# manual_review are all in state when email_context is assembled.
workflow.add_edge("final_contract_builder", "metric_analyst")
workflow.add_edge("metric_analyst",         END)

# --- Compile (once) ---
verification_graph = workflow.compile()
