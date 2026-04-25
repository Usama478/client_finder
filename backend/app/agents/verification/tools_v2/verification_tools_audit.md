# Verification Tools V2 — Audit Report

## Executive Summary
This report provides an exhaustive, line-by-line technical audit of the `backend/app/agents/verification/tools_v2/` directory. The current implementation relies heavily on custom heuristic logic, regular expressions, and a hybrid HTTP/Playwright scraping architecture. While the code is defensively written (extensive use of `try/except` to prevent fatal crashes), it suffers from fragility inherent in homegrown scraping and data extraction. 

The biggest reliability gap lies in the custom scraping infrastructure and heuristic extraction methods (like regex for company size and contact info). Relying on these custom implementations is highly inefficient and prone to silent failures. Upgrading to a professional commercial scraping service, as you are considering, would be significantly more robust, providing built-in proxy rotation, JavaScript rendering, and anti-bot evasion for scraping multiple pages simultaneously. Furthermore, replacing heuristic scripts with dedicated enrichment APIs (e.g., Apollo, Clearbit, Hunter) will drastically improve data accuracy for contacts and company firmographics.

## File-by-File Overview
1. **`__init__.py`**: Empty initialization file.
2. **`accessibility.py`**: Performs lightweight HEAD/GET requests to determine site reachability, SSL validity, redirect chains, and detect WAF blocks. Also performs WHOIS queries for domain age.
3. **`collector.py`**: A deterministic multi-page HTTP crawler. It fetches the homepage, scores internal links based on keywords, and fetches up to 4 high-priority sub-pages (e.g., Contact, About). Falls back to Playwright if the visible text is insufficient.
4. **`contact_extract.py`**: Pure logic script using complex regex patterns to extract emails, phone numbers, social links, and detect contact forms from raw text. Includes de-obfuscation logic (e.g., Cloudflare email decoding).
5. **`identity.py`**: Resolves business identity by cross-referencing extracted names and countries from JSON-LD schema, `<title>`, `<h1>`, and footers against database lead records using fuzzy matching.
6. **`intelligence.py`**: The only file containing an LLM call. It uses `gpt-4o-mini` with structured JSON output to extract qualitative business intelligence (price positioning, target customer, brand tone).
7. **`legitimacy.py`**: Computes a deterministic 0-100 legitimacy score based on 11 binary signals (e.g., presence of privacy policy, physical address, non-free domain email).
8. **`size_estimate.py`**: Estimates employee range and revenue band using fragile regex keyword matching on scraped text and ecommerce platform hints.

## Scraping Infrastructure
**Behavior and URL Selection:**
- The scraping infrastructure is entirely orchestrated by `collector.py`. It does not just scrape the homepage; it actively discovers and scrapes subpages.
- `collector.py` first fetches the homepage using `_http_fetch()`.
- It extracts all internal `<a href>` links and scores them using `_score_link()`. Links containing keywords like "contact," "support," "b2b," "team," or "about" receive the highest scores.
- It then visits up to 4 of the highest-scoring internal pages to gather a comprehensive dataset, meaning up to 5 pages (`MAX_PAGES = 5`) are scraped per business.

**Clients and Configuration:**
- **Plain HTTP**: Default fetching is done using `requests.get()` with a standard `User-Agent` (`Mozilla/5.0... Chrome/125.0.0.0 Safari/537.36`), an `Accept` header, and a 10-second timeout.
- **Playwright Fallback**: If the HTTP response yields fewer than `_MIN_VISIBLE_CHARS` (300 characters), it assumes the site is a JavaScript shell or Single Page Application (SPA). It dynamically imports `_run_playwright_session` from the Relevancy Agent (`app.agents.relevancy.tools_v2.browser_collect`) to render the page with a headless browser, utilizing a 12-second timeout and a stealth setup.

**Proxies, IP Rotation, and Failure Handling:**
- **Proxy/IP Rotation**: There is **no proxy or IP rotation** configured natively within this folder for `requests`. All traffic comes from the host server IP. 
- **Timeouts/Failures**: Handled gracefully. `_http_fetch()` catches `ReqConnectionError` and `Timeout`, returning a standardized error string (`"network:Timeout"`). The main `collect_pages()` function logs these to an `errors` list and continues attempting other links. It never crashes the pipeline.

**Regarding your proposed Scraper Service:**
The scraping service you are thinking of buying would be a massive upgrade. Since your architecture is already designed to scrape multiple pages (homepage + 4 subpages) to extract deep information, a commercial scraper service will easily handle JS rendering, CAPTCHA solving, and IP rotation automatically. This removes the need for your fragile Playwright fallback and eliminates blocks.

## Accessibility & Site Checks
**How `accessibility.py` Checks Liveness:**
- Uses a fast `requests.head()` request with `allow_redirects=True` and an 8-second timeout.
- Validates the final status code.
- If it encounters ambiguous or block-like status codes (401, 403, 405, 429, 503) or an empty body on a 200 OK, it immediately falls back to `requests.get(stream=True)`. It reads only the first 8 KB of the response body to perform a lightweight check without downloading massive assets.

**What It Measures:**
- `live`: Boolean indicating if a 2xx/3xx response was reached without WAF block text.
- `ssl_valid`: Boolean checking if the `final_url` starts with `https://`.
- `redirect_detected`: Boolean checking if the final resolved URL is different from the input.
- **Block Markers**: Scans the 8 KB body for substrings like `"cloudflare"`, `"access denied"`, `"verify you are human"`, and `"captcha"`.
- **Domain Age**: Uses the `whois` library in a thread pool to query domain registry data and compute the domain age in years.

**Return on Failure:**
When unreachable, it returns a dictionary indicating `"live": False` and a specific `"status"` which can be:
- `"dead"` (404, 410)
- `"ambiguous"` (408, 500, 502, 504 timeouts/server errors)
- `"blocked"` (WAF marker found)
- `"system_error"` (unhandled exception)

## Contact & Email Extraction
**What `contact_extract.py` Does:**
- It is a pure logic module that ingests raw HTML/text and extracts contact vectors: emails, phone numbers, WhatsApp links, LinkedIn company URLs, and social profiles.

**Pages Visited & Methods Used:**
- It **does not visit pages itself**. It processes the `merged_text` and raw HTML returned by `collector.py`.
- **Methods**: It relies entirely on Regular Expressions (regex) and deterministic string parsing. There are **no LLMs** involved here.
- It features an interesting de-obfuscation routine `_deobfuscate_text()` which reverses Cloudflare `data-cfemail` hex strings and normalizes `[at]` and `[dot]` text patterns back into standard email addresses.
- It ranks emails using `_EMAIL_RANK` to prioritize "buying/sales" emails over "info/support" emails.

**Empty Returns:**
- If nothing is found, it fails safely, returning empty arrays and Nulls: `{"all_emails": [], "primary_email": None, "contact_form_present": False, ...}`.

## Identity Verification
**What `identity.py` Checks:**
- It verifies if the scraped website actually belongs to the business name in your database, and attempts to confirm the country and physical address.

**How It Verifies Match:**
1. **Name Extraction**: It uses a strict priority hierarchy to find the true company name from the website:
   - First, it parses nested `<script type="application/ld+json">` blocks to find the schema.org `"Organization"` name.
   - Second, it looks at the `<title>` tag, splitting on pipes `|` or dashes `-`.
   - Third, it looks at `<h1>` tags.
   - Fourth, it looks for copyright footers `© 2024 [Name]`.
2. **Fuzzy Matching**: It takes the extracted name and runs `difflib.SequenceMatcher` against the target database name.
   - Ratio > 0.7 = 90% confidence.
   - Ratio > 0.4 = 60% confidence.
   - Otherwise = 20% confidence.

**External Data Sources:**
- **None**. It relies entirely on the provided HTML/text strings and hardcoded country/TLD dictionaries mapping to ISO-3166-1 alpha-2.

## Legitimacy Checks
**What `legitimacy.py` Evaluates:**
- Calculates a 0-100 score indicating how "real" or established a business appears, outputting a dictionary with `legitimacy_score` and a list of `risk_flags`.

**Signals Used:**
It evaluates 11 strict heuristic signals:
1. Valid SSL (+10)
2. Live website (+10)
3. About page present (+10)
4. Contact page present (+8)
5. Non-free domain email (+15) (checks against `_FREE_EMAIL_DOMAINS` like gmail/yahoo)
6. Phone number present (+8)
7. Physical address present (+12) (regex `_STREET_RE` looking for "[Numbers] [Word] Street/Rd/Ave")
8. Privacy policy present (+8)
9. Terms & Conditions present (+5)
10. Social media profiles > 0 (+8)
11. Domain age >= 2 years (+6)

**External APIs:**
- **None**. It only uses inputs provided as function arguments (HTML strings, booleans, and WHOIS domain age passed from earlier tools).

## Size Estimation
**What `size_estimate.py` Does:**
- Attempts to bucket a company into an `employee_range` (e.g., "11-50") and a `revenue_band` (e.g., "small", "medium").

**Signals Used:**
- **Text Regex**: Scans for literal phrases like `"50+ stores"` -> 200+, `"growing team"` -> 11-50, `"boutique"` -> 1-10.
- **Platform Weak Signals**: If text matching fails, it looks at the e-commerce platform. `"shopify plus"` or `"magento"` yields 51-200. Standard `"shopify"` yields 1-50.

**Reliability:**
- **Extremely unreliable**. This is the weakest file in the folder. Regex matching for "boutique" or "growing team" is highly inaccurate and guarantees false positives/negatives in real-world B2B analysis.

## Intelligence Gathering
**What `intelligence.py` Does:**
- Extracts deep factual data (categories, positioning, B2B intent, markets) that cannot be parsed by regex.

**LLM Usage:**
- **Yes**, this is the only module that uses an LLM. It calls OpenAI's `gpt-4o-mini` using `langchain_openai.ChatOpenAI`.
- It passes the truncated website text (capped at 6000 chars) and a strict system prompt instructing it *not* to judge relevance, but purely extract facts.

**Structured Output:**
- Uses the `"json_object"` response format and Pydantic validation to enforce the `BusinessIntelligenceOutput` schema:
  - `product_categories` (List[str])
  - `product_keywords` (List[str])
  - `price_positioning` (Enum: luxury, mid-market, budget)
  - `target_customer` (Enum: B2C, B2B, both)
  - `buys_externally` (Bool)
  - `b2b_language_detected` (Bool)
  - `company_description` (String, 2-3 sentences)
  - `brand_tone` (Enum)
  - `markets_served` (List[str])
  - `ecommerce_enabled` (Bool)

## Collector Orchestration
**What `collector.py` Orchestrates:**
- It is the core engine for website crawling. It manages the multi-step flow: fetch homepage -> extract DOM links -> score link text -> fetch top 4 sub-pages -> merge text data.

**Internal Calls:**
- **No**. `collector.py` does not call `identity.py`, `contact_extract.py`, etc. It only handles HTTP transport, DOM parsing, and Playwright execution. It is designed to be called by an external orchestrator agent that passes the output text to the other tools.

**Inputs and Outputs:**
- **Input**: `base_url` (String) and `already_collected` (Set of URLs to skip).
- **Output**: A comprehensive dictionary containing `pages_collected` (URL to text mapping), raw HTML strings for homepage/contact/about, a `merged_text` string (capped at 25,000 chars), the `method` used ("http", "playwright", "mixed", "failed"), and a list of `errors`.

## Dependencies & Environment Variables
**External Libraries Imported:**
- `requests`
- `bs4` (BeautifulSoup4)
- `playwright.sync_api`
- `whois` (python-whois)
- `langchain_openai`
- `pydantic`

**Existing Third-Party API Calls:**
- **OpenAI API**: For `gpt-4o-mini` in `intelligence.py`.
- **WHOIS Registry**: Though not a traditional SaaS API, `whois` performs external network queries over port 43.

**Environment Variables:**
- None are explicitly called via `os.getenv()` in these files, but `langchain_openai` intrinsically requires `OPENAI_API_KEY` to function.

## Data Flow
**Exact Input to Folder:**
- The tools expect atomic inputs managed by an external orchestrator (likely `app/agents/verification/agent.py`). Inputs are usually: `url`, `business_name`, `address` (from database), and the text/HTML outputs from `collector.py`.

**Exact Output:**
- Each tool outputs a dedicated, flat Python dictionary matching its domain (e.g., identity dictionary, contact dictionary, intelligence dictionary). The orchestrator merges these dictionaries to update the database lead record.

**Internal Interactions:**
- **None**. The files do not import or call each other. They operate strictly in parallel or sequentially based on how the external caller orchestrates them. 

## Critical Failure Modes
1. **Collector Anti-Bot Blocking**: `requests` uses a static user-agent and host IP. It will be immediately blocked by Cloudflare or Datadome on modern ecommerce sites. The Playwright fallback is heavy, slow, and also lacks proxy rotation, causing silent timeouts or empty text returns.
2. **WHOIS Timeout Bottleneck**: Port 43 WHOIS queries are frequently rate-limited or blocked by ISPs, causing `accessibility.py` to return `None` for domain age and dragging down pipeline speed.
3. **Regex Fragility**: `size_estimate.py` relies on marketing buzzwords ("growing team", "enterprise") which are terrible proxies for actual headcount or revenue. `legitimacy.py` uses a rigid regex (`_STREET_RE`) for physical addresses that easily fails on international formatting.
4. **Missing Contacts**: `contact_extract.py` regex will miss heavily obfuscated JS-rendered contacts or emails hidden in deep iFrames.

## Keep vs Replace Recommendation

| Function / Logic | File | Keep or Replace | Reason | Replace With |
| :--- | :--- | :--- | :--- | :--- |
| **Business Intelligence Extraction** (`run_business_intelligence`) | `intelligence.py` | **Keep** | LLM extraction using structured JSON is highly effective for qualitative signals (tone, product categories). | N/A |
| **Legitimacy Scoring** (`compute_legitimacy`) | `legitimacy.py` | **Keep / Refactor** | The 11-point deterministic scoring is conceptually sound, but the inputs (like address regex) need upgrading. | N/A |
| **Identity Resolution** (`resolve_identity`) | `identity.py` | **Keep / Refactor** | JSON-LD parsing and fuzzy matching is good, but should rely on structured data from APIs rather than regex parsing. | N/A |
| **Multi-page Crawler** (`collect_pages`) | `collector.py` | **Replace** | Fragile, easily blocked, lacks proxy rotation, and Playwright fallback is resource-heavy. | **Scraping API** (e.g., Firecrawl, Browserbase, or ScrapingBee) that handles multi-page crawling, JS rendering, and proxy rotation natively. |
| **Accessibility Check** (`check_accessibility`) | `accessibility.py` | **Replace** | Hardcoded block markers change daily. WHOIS is unstable and slow. | **Scraping API** (for liveness) + **Firmographic API** (Clearbit/Apollo for domain age). |
| **Contact Extraction** (`extract_contacts`) | `contact_extract.py` | **Replace** | Regex misses edge cases and cannot find emails not publicly listed on the site. | **Email Finder/Enrichment API** (e.g., Hunter.io, Apollo, Snov.io). |
| **Size Estimation** (`estimate_size`) | `size_estimate.py` | **Replace** | Extremely unreliable regex keyword matching ("boutique", "family business"). | **Firmographic API** (e.g., LinkedIn API, Apollo, Clearbit) for accurate headcount/revenue. |
