import os
import json
import httpx
from bs4 import BeautifulSoup
from urllib.parse import urlparse
from langchain_openai import ChatOpenAI
from app.agents.relevancy.state import RelevancyAgentState

# Optional: Try importing Playwright, handle if missing
try:
    from playwright.sync_api import sync_playwright
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False

# -------------------------------------------------
# Constants
# -------------------------------------------------
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"

# Marketplace Rules: 
# "block": URL paths that indicate a generic/junk page.
# "allow": URL paths that indicate a specific seller/storefront (valid lead).
# If a domain matches but no path matches 'allow', we consider it a Marketplace (is_marketplace=True -> Reject).
# If it matches 'allow', we consider it a Business (is_marketplace=False -> Keep).
MARKETPLACE_RULES = {
    "etsy.com": {
        "allow": ["/shop/", "/people/"],
        "block": ["/search", "/c/", "/listing/"], # Listings can be ambiguous, but usually we want the shop.
        "type": "B2C"
    },
    "amazon.com": {
        "allow": ["/stores/", "/sp?"], 
        "block": ["/s?", "/search", "/dp/", "/gp/"], 
        "type": "B2C"
    },
    "alibaba.com": {
        "allow": ["pass.alibaba.com/company/"], # Profile pages
        "block": ["/showroom/", "/catalog/", "/bulk"], 
        "type": "B2B"
    },
    "facebook.com": {
        "allow": ["/pages/"], # Might be a business page
        "block": ["/marketplace"],
        "type": "Social"
    },
    "ebay.com": {
        "allow": ["/str/", "/usr/"],
        "block": ["/sch/", "/itm/"],
        "type": "B2C"
    }
    # Add more as needed
}

SIMPLE_MARKETPLACES = {
    "aliexpress", "daraz", "flipkart", "walmart", "yelp", "yellowpages", 
    "linkedin", "pinterest", "temu", "shein"
}

PARKED_KEYWORDS = [
    "domain for sale", "this domain is parked", "buy this domain", 
    "godaddy", "sedo", "namecheap", "domain is available"
]

# -------------------------------------------------
# Phase 1: Gatekeepers
# -------------------------------------------------

def fetch_website_status(state: RelevancyAgentState) -> dict:
    """
    Hybrid Approach:
    1. Try fast HTTPX (requests-like) check first.
    2. If that fails or looks like a "JS Required" page, fall back to Playwright.
    """
    raw_url = state.get("website")
    if not raw_url:
        return {"website_exists": False}
    
    # Ensure protocol
    if not raw_url.startswith("http"):
        url = f"https://{raw_url}"
    else:
        url = raw_url

    print(f"   🔍 Checking status for: {url}")

    # --- Phase A: Fast Check (HTTPX) ---
    try:
        with httpx.Client(timeout=10.0, follow_redirects=True, headers={"User-Agent": USER_AGENT}) as client:
            response = client.get(url)
            
            # 1. Check Status Code
            if response.status_code == 200:
                content_sample = response.text[:2000].lower()
                
                # Check for "JavaScript Required" stubs
                js_warning = "enable javascript" in content_sample or "javascript is required" in content_sample
                
                # If valid content and not a JS stub
                if len(response.content) > 500 and not js_warning:
                    # Check for Parked Domain signatures even in HTML
                    if not any(k in content_sample for k in PARKED_KEYWORDS):
                        return {
                            "website_exists": True, 
                            "website": str(response.url) # Update URL if redirected
                        }
                    else:
                        print("   ⚠️ Detected Parked Domain via HTML.")
                        return {"website_exists": False}
                else:
                    print("   ⚠️ Content too short or JS required. Switching to Playwright.")
            else:
                print(f"   ⚠️ HTTPX Status {response.status_code}. Switching to Playwright.")

    except Exception as e:
        print(f"   ⚠️ HTTPX Check Failed: {e}. Switching to Playwright.")

    # --- Phase B: Fallback (Playwright) ---
    if not PLAYWRIGHT_AVAILABLE:
        print("   🚫 Playwright not installed. Following Phase A failure.")
        return {"website_exists": False}

    try:
        with sync_playwright() as p:
            # Launch strictly headless to be fast
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(user_agent=USER_AGENT)
            
            try:
                # 15s timeout for loading
                response = page.goto(url, wait_until="domcontentloaded", timeout=15000)
                
                if not response:
                    browser.close()
                    return {"website_exists": False}
                
                # Check final status
                status = response.status
                final_url = page.url
                
                if status >= 400:
                    browser.close()
                    return {"website_exists": False}

                # Evaluate content
                body_text = page.inner_text("body").lower()
                
                # Check for Parked Domain (Visual text)
                if any(k in body_text for k in PARKED_KEYWORDS):
                    print("   🚫 Parked Domain detected by Playwright.")
                    browser.close()
                    return {"website_exists": False}

                browser.close()
                return {
                    "website_exists": True,
                    "website": final_url
                }
                
            except Exception as exc:
                print(f"   🚫 Playwright Navigation Error: {exc}")
                browser.close()
                return {"website_exists": False}

    except Exception as e:
        print(f"   🚫 Playwright Critical Error: {e}")
        return {"website_exists": False}


def detect_marketplace(state: RelevancyAgentState) -> dict:
    """
    Advanced Marketplace Detector.
    Distinguishes between a 'Marketplace' (junk) and a 'Storefront' (lead).
    """
    url = state.get("website") or ""
    if not url: return {"is_marketplace": False}
    
    parsed = urlparse(url if url.startswith("http") else f"https://{url}")
    domain = parsed.netloc.lower()
    path = parsed.path.lower()
    full_url = url.lower()

    # 1. Check Complex Rules
    for mp_domain, rules in MARKETPLACE_RULES.items():
        if mp_domain in domain:
            # Check ALLOW patterns (It's a store/profile -> NOT a marketplace for filtering purposes)
            if any(allow in full_url for allow in rules.get("allow", [])):
                print(f"   ✅ Idendtified Storefront on {mp_domain} (Keeping).")
                return {"is_marketplace": False, "is_storefront": True}
            
            # Check BLOCK patterns (It's a search/category page -> IS a marketplace)
            if any(block in full_url for block in rules.get("block", [])):
                print(f"   🛑 Identified Generic Page on {mp_domain} (Rejecting).")
                return {"is_marketplace": True}
            
            # Default for that domain (usually Reject if it's just the homepage)
            if path == "/" or path == "":
                return {"is_marketplace": True}
            
            # Ambiguous path on a known marketplace -> Lean towards Reject
            return {"is_marketplace": True}

    # 2. Check Simple List
    if any(m in domain for m in SIMPLE_MARKETPLACES):
        return {"is_marketplace": True}

    return {"is_marketplace": False}



# -------------------------------------------------
# NEW PRO TOOLS: Investigator & Analyst
# -------------------------------------------------

def gather_website_evidence(state: RelevancyAgentState) -> dict:
    """
    [Investigator Tool] 
    Scrapes 'Hard Evidence' using Playwright (Hybrid Loading).
    Missions: Homepage, About, Products, B2B Signals.
    """
    url = state.get("website")
    if not url:
        return {"evidence": {}}
    if not url.startswith("http"):
        url = f"https://{url}"

    print(f"   🕵️ Investigator: Gathering evidence from {url}")

    if not PLAYWRIGHT_AVAILABLE:
        print("   ⚠️ Playwright needed for Investigator tools.")
        return {"evidence": {"error": "Playwright not available"}}

    evidence = {
        "homepage": {"title": "", "meta": "", "cta": ""},
        "about_page": {"found": False, "summary": ""},
        "products": {"found": False, "samples": []},
        "b2b_signals": {"found": False, "keywords": []}
    }

    try:
        with sync_playwright() as p:
            # 1. Launch & Homepage
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(user_agent=USER_AGENT)
            page = context.new_page()
            
            try:
                initial_nav_ok = False
                for attempt in range(2):
                    try:
                        page.goto(url, wait_until="domcontentloaded", timeout=20000)
                        try:
                            page.wait_for_load_state("load", timeout=5000)
                        except Exception as load_exc:
                            print(f"   ⚠️ Investigator load-state wait warning (home): {load_exc}")
                        initial_nav_ok = True
                        break
                    except Exception as nav_exc:
                        print(f"   ⚠️ Investigator initial navigation attempt {attempt + 1} failed: {nav_exc}")

                if not initial_nav_ok:
                    print("   ⚠️ Investigator failed to load homepage after retries. Returning partial evidence.")
                    return {"evidence": evidence}

                # --- Mission 1: Homepage Metadata ---
                evidence["homepage"]["title"] = page.title()
                
                # Meta Description
                meta_desc = page.locator('meta[name="description"]').first
                if meta_desc.count() > 0:
                    evidence["homepage"]["meta"] = meta_desc.get_attribute("content") or ""
                    
                # Primary CTA (Simple Heuristic: First button/link with typical keywords)
                cta_candidates = ["Shop Now", "Buy Now", "Contact Us", "Get Started", "Learn More", "View Products"]
                for cta in cta_candidates:
                    # Case insensitive search for button or link text
                    loc = page.get_by_text(cta, exact=False).first
                    if loc.is_visible():
                        evidence["homepage"]["cta"] = cta
                        break
                        
                # --- Mission 4: B2B Signals (Check Home + Header/Footer) ---
                body_text = page.inner_text("body").lower()
                b2b_keywords = ["wholesale", "dealer", "trade program", "distributor", "stockist"]
                found_b2b = [k for k in b2b_keywords if k in body_text]
                if found_b2b:
                    evidence["b2b_signals"]["found"] = True
                    evidence["b2b_signals"]["keywords"] = list(set(found_b2b))
                    
                # --- Mission 2: Smart Navigation (About Page) ---
                # Check for links
                about_keywords = ["about", "story", "mission", "company"]
                found_link = None
                
                # Try simple locators
                for keyword in about_keywords:
                    # Look for link with text containing keyword
                    links = page.locator(f"a:has-text('{keyword}')") # Case sensitive-ish in CSS, but Playwright text selector is better
                    count = links.count()
                    for i in range(count):
                        href = links.nth(i).get_attribute("href")
                        if href and len(href) > 1: # Avoid empty links
                            found_link = href
                            break
                    if found_link: break
                
                if found_link:
                    try:
                        # Navigate
                        page.goto(found_link if found_link.startswith("http") else f"{url.rstrip('/')}/{found_link.lstrip('/')}", timeout=10000)
                        try:
                            page.wait_for_load_state("load", timeout=5000)
                        except Exception as load_exc:
                            print(f"   ⚠️ Investigator load-state wait warning (about): {load_exc}")
                        evidence["about_page"]["found"] = True
                        evidence["about_page"]["summary"] = page.inner_text("body")[:500].replace("\n", " ")
                    except Exception as about_exc:
                        print(f"   ⚠️ Investigator about-page navigation warning: {about_exc}")
                    finally:
                        # Go back home or just re-use context? Better to go to next mission
                        pass
                
                # --- Mission 3: Product Scan ---
                # We need to find a shop page. If we are already on a shop, great. If not, find link.
                # If we went to 'About', let's try to go to 'Shop'.
                
                # Re-load home to be safe/clean? Or just look for nav.
                # If we are on About page, nav is likely still there.
                
                shop_keywords = ["shop", "products", "catalog", "services", "collection"]
                shop_link = None
                
                for keyword in shop_keywords:
                    links = page.locator(f"a:has-text('{keyword}')")
                    count = links.count()
                    for i in range(count):
                        href = links.nth(i).get_attribute("href")
                        if href and len(href) > 1:
                            shop_link = href
                            break
                    if shop_link: break
                    
                if shop_link:
                    try:
                        target = shop_link if shop_link.startswith("http") else f"{url.rstrip('/')}/{shop_link.lstrip('/')}"
                        page.goto(target, timeout=10000)
                        try:
                            page.wait_for_load_state("load", timeout=5000)
                        except Exception as load_exc:
                            print(f"   ⚠️ Investigator load-state wait warning (shop): {load_exc}")
                        evidence["products"]["found"] = True
                        
                        # extract sample titles (h2, h3, or common product class names?)
                        # Generic approach: Find headings h1-h4 inside main area. 
                        # Or look for typical product grid items.
                        # Let's just grab the most common H2/H3 text or list items.
                        
                        samples = []
                        # Try grabbing first 5 h2s or h3s that look like titles
                        headings = page.locator("h1, h2, h3, h4, .product-title, .card-title")
                        count = min(headings.count(), 10)
                        for i in range(count):
                            txt = headings.nth(i).inner_text().strip()
                            if len(txt) > 3 and txt not in ["Menu", "Search", "Cart", "Account", "Filter"]:
                                samples.append(txt)
                        
                        evidence["products"]["samples"] = samples[:5]
                    except Exception as shop_exc:
                        print(f"   ⚠️ Investigator shop-page navigation warning: {shop_exc}")

            except Exception as e:
                print(f"   ⚠️ Investigator Navigation Error: {e}")
            finally:
                browser.close()

    except Exception as e:
        print(f"   ⚠️ Investigator Critical Error: {e}")
        
    return {"evidence": evidence}


def analyze_relevance_with_llm(state: RelevancyAgentState) -> dict:
    """
    [Analyst Tool] 
    Uses Gemini/GPT to judge the evidence according to B2B Priority protocols.
    """
    evidence = state.get("evidence", {})
    user_criteria = state.get("exporter_profile", "")
    
    print("   📊 Analyst: Judging evidence...")
    
    if not evidence or "error" in evidence:
        return {
            "relevance_score": 0,
            "relevance_decision": "unknown",
            "reason": "No evidence collected"
        }

    try:
        # 1. Initialize Model
        llm = ChatOpenAI(
            model="gpt-4o-mini",
            temperature=0,
            model_kwargs={"response_format": {"type": "json_object"}}
        )

        # 2. Construct Prompt
        prompt = f"""
        You are The Analyst. Judge this business based on the Hard Evidence collected.
        
        USER CRITERIA: {user_criteria}
        
        EVIDENCE:
        {json.dumps(evidence, indent=2)}
        
        LOGIC RULES:
        1. B2B Priority: If 'b2b_signals' are found (wholesale, dealer, etc.), classify as Wholesaler/Distributor (High Value).
        2. Product Fit: Check 'products.samples'. If they are unrelated to the User Criteria, mark Irrelevant.
        3. Conflict Resolution: Trust 'products.samples' over 'homepage.meta' if they contradict.
        
        Return JSON Key-Values:
        - relevance_score (0-100)
        - decision ("relevant" or "irrelevant")
        - reason (Explain why based on evidence)
        - business_type (e.g. Retailer, Wholesaler, Manufacturer)
        - primary_niche (e.g. Leather, Software, Home Goods)
        """
        
        messages = [
            ("system", "You are a helpful analyst that outputs strict JSON."),
            ("user", prompt)
        ]
        
        # 3. Invoke
        response = llm.invoke(messages)
        data = json.loads(response.content)
        
        return {
            "relevance_score": data.get("relevance_score", 0),
            "relevance_decision": data.get("decision", "irrelevant"),
            "relevance_reason": data.get("reason", "Analysis Failed"),
            "business_type": data.get("business_type", "Unknown"),
            "primary_niche": data.get("primary_niche", "Unknown"),
            "is_finalized": True
        }

    except Exception as e:
        print(f"   ❌ Analyst Error: {e}")
        return {
            "relevance_score": 0,
            "relevance_decision": "irrelevant",
            "relevance_reason": f"Error: {str(e)}",
            "is_finalized": True
        }
