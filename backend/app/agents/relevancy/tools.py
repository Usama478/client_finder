import os
import json
import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse
from langchain_openai import ChatOpenAI
from app.agents.relevancy.state import RelevancyAgentState

# -------------------------------------------------
# Constants
# -------------------------------------------------
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"

KNOWN_MARKETPLACES = {
    "amazon", "ebay", "etsy", "alibaba", "aliexpress", 
    "daraz", "flipkart", "walmart", "yelp", "yellowpages", 
    "linkedin", "facebook", "instagram", "pinterest"
}

# -------------------------------------------------
# Phase 1: Gatekeepers
# -------------------------------------------------

def fetch_website_status(state: RelevancyAgentState) -> dict:
    url = state.get("website")
    if not url: return {"website_exists": False}
    if not url.startswith("http"): url = f"https://{url}"
    
    try:
        response = requests.head(url, headers={"User-Agent": USER_AGENT}, timeout=8, allow_redirects=True)
        if response.status_code < 400: return {"website_exists": True}
        response = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=8)
        return {"website_exists": response.status_code < 400}
    except:
        return {"website_exists": False}

def detect_marketplace(state: RelevancyAgentState) -> dict:
    url = state.get("website")
    if not url: return {"is_marketplace": False}
    domain = urlparse(url if url.startswith("http") else f"https://{url}").netloc.lower()
    return {"is_marketplace": any(m in domain for m in KNOWN_MARKETPLACES)}

# -------------------------------------------------
# Phase 2: Data Collection
# -------------------------------------------------

def scrape_homepage_text(state: RelevancyAgentState) -> dict:
    url = state.get("website")
    if not url: return {"homepage_text": ""}
    if not url.startswith("http"): url = f"https://{url}"

    try:
        response = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=15)
        soup = BeautifulSoup(response.text, "html.parser")
        for tag in soup(["script", "style", "noscript", "header", "footer", "nav"]):
            tag.decompose()
        text = soup.get_text(separator=" ", strip=True)
        return {"homepage_text": text[:4000]}
    except:
        return {"homepage_text": ""}

def detect_business_model_heuristic(state: RelevancyAgentState) -> dict:
    text = (state.get("homepage_text") or "").lower()
    if any(w in text for w in ["manufacturer", "factory", "production", "oem"]):
        return {"business_model": "Manufacturer"}
    if "wholesale" in text or "bulk" in text:
        return {"business_model": "Wholesaler"}
    if any(w in text for w in ["cart", "shop", "shipping"]):
        return {"business_model": "E-Commerce"}
    return {"business_model": "Unknown"}

def extract_product_keywords(state: RelevancyAgentState) -> dict:
    text = (state.get("homepage_text") or "").lower()
    target_words = ["clothing", "apparel", "textile", "fabric", "shoes", "leather", "software", "tech"]
    found = [word for word in target_words if word in text]
    return {"extracted_keywords": list(set(found))}

def classify_business_niche(state: RelevancyAgentState) -> dict:
    text = (state.get("homepage_text") or "").lower()
    if "software" in text or "app" in text: return {"classified_niche": "Tech"}
    if "luxury" in text: return {"classified_niche": "Luxury"}
    return {"classified_niche": "General"}

# -------------------------------------------------
# Phase 3: Semantic Analysis (CRASH PROOF VERSION)
# -------------------------------------------------

def semantic_analysis(state: RelevancyAgentState) -> dict:
    """
    Uses OpenAI JSON Mode directly.
    """
    print(f"   🧠 AI: Analyzing {state.get('business_name')}...")
    
    try:
        # 1. Initialize Standard Chat Model
        llm = ChatOpenAI(
            model="gpt-4o-mini", 
            temperature=0,
            model_kwargs={"response_format": {"type": "json_object"}}
        )
        
        # FIX IS HERE: Handle None safely before slicing
        website_text = state.get("homepage_text") or "" 
        
        # 2. Manual Prompt Engineering
        prompt_text = f"""
        You are an Expert Lead Qualifier.
        
        USER CRITERIA: {state.get("exporter_profile")}
        
        BUSINESS EVIDENCE:
        - Name: {state.get("business_name")}
        - Keywords: {state.get("extracted_keywords")}
        - Model: {state.get("business_model")}
        - Website Status: {"Alive" if state.get("website_exists") else "Dead/Unreachable"}
        
        WEBSITE TEXT:
        {website_text[:3000]}
        
        TASK:
        Analyze if this business is relevant.
        If the website is dead or text is empty, you can mark it irrelevant immediately.
        
        Return strictly valid JSON:
        - relevance_score (0-100)
        - relevance_decision ("relevant" or "irrelevant")
        - relevance_reason (concise reason)
        """
        
        # 3. Invoke
        messages = [
            ("system", "You are a helpful assistant that outputs JSON."),
            ("user", prompt_text)
        ]
        
        response = llm.invoke(messages)
        
        # 4. Manual Parsing
        content = response.content
        data = json.loads(content)
        
        return {
            "relevance_score": data.get("relevance_score", 0),
            "relevance_decision": data.get("relevance_decision", "irrelevant"),
            "relevance_reason": data.get("relevance_reason", "AI Analysis Failed"),
            "is_finalized": True
        }

    except Exception as e:
        print(f"   ❌ LLM Error: {e}")
        return {
            "relevance_score": 0,
            "relevance_decision": "irrelevant",
            "relevance_reason": f"Error: {str(e)}",
            "is_finalized": True
        }