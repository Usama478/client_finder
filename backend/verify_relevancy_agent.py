import logging
from collections import Counter
from app.agents.relevancy.service_v2 import run_relevancy_v2_for_business
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
TARGET_IDS = list(range(61, 65)) # Testing 61 to 80

def run_batch():
    summary = Counter()
    logger.info(f"Starting REAL SaaS batch test for IDs: {TARGET_IDS}")

    with SessionLocal() as db:
        rows = db.query(SearchResult).filter(SearchResult.result_id.in_(TARGET_IDS)).all()

    if not rows:
        logger.warning(f"No records found for IDs {TARGET_IDS}! Run your Discovery Agent scraper first.")
        return

    for row in rows:
        logger.info("=" * 80)
        logger.info(f"🎯 TARGET: ID {row.result_id:02d} | {row.business_name} | {row.website}")
        
        try:
            # CALLING THE ACTUAL PRODUCTION SERVICE LAYER
            result = run_relevancy_v2_for_business(
                business_id=row.result_id,
                website=row.website,
                exporter_profile=EXPORTER_PROFILE,
                search_id=row.search_id or 0,
                business_name=row.business_name,
            )
            
            # Check if our concurrency lock blocked it
            if result.get("status") == "ignored":
                logger.warning("⚠️ ALREADY PROCESSING (Lock working)")
                summary["IGNORED_LOCKED"] += 1
                continue
                
            relevance = result.get("relevance_decision", "unknown")
            summary[relevance] += 1
            
            logger.info(f"✅ DECISION: {relevance.upper()}")
            logger.info(f"📝 REASON  : {result.get('relevance_reason')}")
            
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