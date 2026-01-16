from app.agents.relevancy.state import RelevancyAgentState

# -------- GATEKEEPER TOOLS --------
def fetch_website_status(state: RelevancyAgentState) -> dict:
    print("   🛠️ TOOL: Checking website status...")
    # MOCK: Always say the website is alive
    return {"website_exists": True}

def detect_marketplace(state: RelevancyAgentState) -> dict:
    print("   🛠️ TOOL: Checking if it is a marketplace...")
    # MOCK: Say it is NOT a marketplace (it's a real business)
    return {"is_marketplace": False}

# -------- DATA COLLECTION TOOLS --------
def scrape_homepage_text(state: RelevancyAgentState) -> dict:
    print("   🛠️ TOOL: Scraping homepage text...")
    # MOCK: Return fake fashion brand text
    return {"homepage_text": "Welcome to Urban Vogue. We are a fashion brand looking for manufacturing partners for our new summer line."}

def detect_business_model(state: RelevancyAgentState) -> dict:
    print("   🛠️ TOOL: Detecting business model...")
    return {"business_model": "B2B Brand"}

def extract_product_keywords(state: RelevancyAgentState) -> dict:
    print("   🛠️ TOOL: Extracting keywords...")
    return {"product_keywords": ["apparel", "clothing", "streetwear", "hoodies"]}

def classify_business_niche(state: RelevancyAgentState) -> dict:
    print("   🛠️ TOOL: Classifying niche...")
    return {"business_niche": "Fashion Brand"}