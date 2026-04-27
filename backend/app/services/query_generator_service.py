import asyncio
import json
import logging
from langchain_openai import ChatOpenAI

logger = logging.getLogger(__name__)


async def generate_search_queries(user_profile: dict, ai_context: str) -> dict:
    """
    Generate structured search queries for Google Maps and web search.
    
    Args:
        user_profile: Dictionary containing user profile information
        ai_context: String containing AI context for query generation
        
    Returns:
        Dictionary with 'maps_queries' and 'web_queries' keys, each containing a list of strings
    """
    system_prompt = """You are a search query generator. Return ONLY a valid JSON object with no preamble, no markdown fences, and no explanation.

The JSON object must have exactly this structure:
{"maps_queries": ["query1", "query2", "query3"], "web_queries": ["query1", "query2", "query3", "query4"]}

Generate 3-5 Google Maps queries (short, location+business-type focused, suitable for the Maps text search API) and 4-6 web search queries (richer, intent-driven, B2B focused)."""

    user_prompt = f"""User Profile:
{json.dumps(user_profile, indent=2)}

AI Context:
{ai_context}

Generate 3-5 Google Maps queries (short, location+business-type focused, suitable for the Maps text search API) and 4-6 web search queries (richer, intent-driven, B2B focused).

Return ONLY the JSON object with no additional text."""

    llm = ChatOpenAI(
        model="gpt-4o-mini",
        temperature=0,
        model_kwargs={"response_format": {"type": "json_object"}},
    )

    try:
        response = await asyncio.to_thread(
            llm.invoke,
            [
                ("system", system_prompt),
                ("user", user_prompt),
            ]
        )
        
        result = json.loads(response.content)
        
        if not isinstance(result, dict):
            raise ValueError("Response is not a dictionary")
        
        if "maps_queries" not in result or "web_queries" not in result:
            raise ValueError("Missing required keys in response")
        
        if not isinstance(result["maps_queries"], list) or not result["maps_queries"]:
            raise ValueError("maps_queries must be a non-empty list")
        
        if not isinstance(result["web_queries"], list) or not result["web_queries"]:
            raise ValueError("web_queries must be a non-empty list")
        
        if not all(isinstance(q, str) for q in result["maps_queries"]):
            raise ValueError("All maps_queries must be strings")
        
        if not all(isinstance(q, str) for q in result["web_queries"]):
            raise ValueError("All web_queries must be strings")
        
        return result
        
    except Exception as e:
        logger.error(f"Error generating search queries: {e}")
        return {"maps_queries": [ai_context], "web_queries": [ai_context]}
