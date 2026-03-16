from __future__ import annotations

from langgraph.graph import END, StateGraph

from app.agents.verification import nodes as _nodes
from app.agents.verification.state import VerificationAgentState


# ------------------------------------------------------------------ #
# Routing                                                             #
# ------------------------------------------------------------------ #

def _route_after_gatekeeper(state: VerificationAgentState) -> str:
    """
    Dead or blocked sites skip the full evidence pipeline and jump straight
    to the email_context_compiler (metric_analyst) so that:
    - email_context is always compiled (never NULL in DB)
    - final_contract_builder still runs and produces a "failed" result
    """
    if state.get("website_alive") is False:
        return "metric_analyst"
    return "site_collector"


# ------------------------------------------------------------------ #
# Graph assembly — 10 nodes                                          #
# ------------------------------------------------------------------ #

workflow = StateGraph(VerificationAgentState)

# Lambda wrappers ensure pytest patching of _nodes.* works correctly
workflow.add_node("input_preparation",      lambda s: _nodes.input_preparation(s))
workflow.add_node("gatekeeper",             lambda s: _nodes.site_accessibility_check(s))
workflow.add_node("site_collector",         lambda s: _nodes.targeted_page_collector(s))
workflow.add_node("identity_resolver",      lambda s: _nodes.identity_resolver(s))
workflow.add_node("contact_extractor",      lambda s: _nodes.contact_extractor(s))
workflow.add_node("legitimacy_analyzer",    lambda s: _nodes.legitimacy_analyzer(s))
workflow.add_node("size_estimator",         lambda s: _nodes.size_estimator(s))
workflow.add_node("llm_analyst",            lambda s: _nodes.business_intelligence_extractor(s))
workflow.add_node("metric_analyst",         lambda s: _nodes.email_context_compiler(s))
workflow.add_node("final_contract_builder", lambda s: _nodes.final_contract_builder(s))

# --- Entry ---
workflow.set_entry_point("input_preparation")

# --- Linear: input_preparation → gatekeeper ---
workflow.add_edge("input_preparation", "gatekeeper")

# --- Branch: alive sites → full pipeline; dead sites → email_context_compiler ---
workflow.add_conditional_edges(
    "gatekeeper",
    _route_after_gatekeeper,
    {
        "site_collector": "site_collector",
        "metric_analyst": "metric_analyst",
    },
)

# --- Happy path: full evidence pipeline ---
workflow.add_edge("site_collector",      "identity_resolver")
workflow.add_edge("identity_resolver",   "contact_extractor")
workflow.add_edge("contact_extractor",   "legitimacy_analyzer")
workflow.add_edge("legitimacy_analyzer", "size_estimator")
workflow.add_edge("size_estimator",      "llm_analyst")
workflow.add_edge("llm_analyst",         "metric_analyst")

# --- Both paths converge at metric_analyst → final_contract_builder → END ---
workflow.add_edge("metric_analyst",         "final_contract_builder")
workflow.add_edge("final_contract_builder", END)

# --- Compile (once) ---
verification_graph = workflow.compile()
