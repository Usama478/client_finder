import asyncio
from app.agents.relevancy.graph import relevancy_graph

async def main():
    print("Testing social media routing...")
    
    # Test valid social profile
    state = {
        "website": "facebook.com/TVFashionOutletDallas",
        "business_id": 1,
        "search_id": 1,
        "business_name": "Test",
        "exporter_profile": "Test"
    }
    
    result = await relevancy_graph.ainvoke(state)
    print("\nResult for facebook.com:")
    print("Decision:", result.get("relevance_decision"))
    print("Reason:", result.get("relevance_reason"))
    print("Signals Used:", result.get("signals_used"))

if __name__ == "__main__":
    asyncio.run(main())
