import logging
from collections import Counter
from app.agents.relevancy.graph import relevancy_graph
from app.db.session import SessionLocal
from app.models.search_result import SearchResult

# Set up clean, real-time logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger(__name__)

EXPORTER_PROFILE = "We are a premium clothing wholesaler looking for B2B fashion retailers, boutiques, and department stores."
TARGET_IDS = list(range(30, 35)) # Testing 30 to 34

def build_state(row):
    raw = row.raw_data if row.raw_data else {}
    return {
        "business_id": row.result_id,
        "search_id": row.search_id or 0,
        "business_name": row.business_name,
        "category": raw.get("category"),
        "website": row.website,
        "exporter_profile": EXPORTER_PROFILE,
        "collect_sources_output": {},
        "llm_decision_output": {},
    }

def run_batch():
    summary = Counter()
    logger.info(f"Starting batch test for IDs: {TARGET_IDS}")

    with SessionLocal() as db:
        rows = db.query(SearchResult).filter(SearchResult.result_id.in_(TARGET_IDS)).all()

    if not rows:
        logger.warning(f"No records found for IDs {TARGET_IDS}! Run your Discovery Agent scraper first.")
        return

    for row in rows:
        logger.info("=" * 80)
        logger.info(f"🎯 TARGET: ID {row.result_id:02d} | {row.business_name} | {row.website}")
        
        try:
            seen_nodes = []
            final_state = {}
            
            # Stream the graph and log every node as it finishes
            for chunk in relevancy_graph.stream(build_state(row)):
                node_name = list(chunk.keys())[0]
                logger.info(f"  🟢 Node Complete: {node_name}")
                seen_nodes.append(node_name)
                
                for v in chunk.values():
                    if isinstance(v, dict):
                        final_state.update(v)

            decision = final_state.get("llm_decision_output") or {}
            relevance = decision.get('relevance_decision', 'unknown')
            summary[relevance] += 1
            
            logger.info(f"✅ DECISION: {relevance.upper()}")
            logger.info(f"📝 REASON  : {decision.get('relevance_reason')}")
            
        except Exception as e:
            logger.error(f"❌ CRASH ON ID {row.result_id}: {type(e).__name__} - {str(e)}")
            summary["ERROR"] += 1

    logger.info("=" * 80)
    logger.info("📊 BATCH SUMMARY")
    for k, v in summary.items():
        logger.info(f"{k.upper()}: {v}")
    logger.info("=" * 80)

if __name__ == "__main__":
    run_batch()