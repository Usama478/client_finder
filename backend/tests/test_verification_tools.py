import sys
import unittest
from unittest.mock import MagicMock, call
from datetime import datetime

# --- MOCK DEPENDENCIES START ---
# We must mock these BEFORE importing app modules because they are imported at top level
sys.modules["whois"] = MagicMock()
sys.modules["requests"] = MagicMock()
sys.modules["playwright"] = MagicMock()
sys.modules["playwright.sync_api"] = MagicMock()
sys.modules["bs4"] = MagicMock()

# Configure bs4 mock to be usable
mock_bs4 = sys.modules["bs4"]
# BeautifulSoup constructor returns a soup object
# We will configure this in the test setup or test method
# --- MOCK DEPENDENCIES END ---

# Now import the modules under test
from app.agents.verification.tools.early_checks import run_gatekeeper_checks
from app.agents.verification.tools.deep_checks import run_trust_scanner

class TestVerificationTools(unittest.TestCase):
    
    def setUp(self):
        # Reset mocks
        sys.modules["requests"].reset_mock()
        sys.modules["whois"].reset_mock()
        sys.modules["playwright.sync_api"].reset_mock()
        sys.modules["bs4"].reset_mock()
        
    def test_gatekeeper_checks_alive_old(self):
        # Setup mocks
        mock_response = MagicMock()
        mock_response.status_code = 200
        sys.modules["requests"].get.return_value = mock_response
        
        mock_w = MagicMock()
        # 10 years ago
        current_year = datetime.now().year
        mock_w.creation_date = datetime(current_year - 10, 1, 1)
        sys.modules["whois"].whois.return_value = mock_w
        
        state = {"website": "example.com"}
        result = run_gatekeeper_checks(state)
        
        self.assertTrue(result['website_alive'])
        self.assertEqual(result['domain_age_years'], 10)

    def test_gatekeeper_checks_dead(self):
        # Setup mocks
        mock_response = MagicMock()
        mock_response.status_code = 404
        sys.modules["requests"].get.return_value = mock_response
        
        state = {"website": "dead.com"}
        result = run_gatekeeper_checks(state)
        
        self.assertFalse(result['website_alive'])
        self.assertEqual(result['domain_age_years'], 0)

    def test_trust_scanner_extraction(self):
        # Mock Playwright
        mock_playwright = sys.modules["playwright.sync_api"]
        mock_p = MagicMock()
        mock_playwright.sync_playwright.return_value.__enter__.return_value = mock_p
        
        mock_browser = MagicMock()
        mock_p.chromium.launch.return_value = mock_browser
        
        mock_context = MagicMock()
        mock_browser.new_context.return_value = mock_context
        
        mock_page = MagicMock()
        mock_context.new_page.return_value = mock_page
        
        mock_page.content.return_value = "<html>dummy</html>"
        
        # Mock BeautifulSoup
        # The code calls: soup = BeautifulSoup(content, "html.parser")
        # Then: soup.find_all('a', href=True)
        # Then: soup.get_text(...)
        # Then: soup.find_all('address')
        # etc.
        
        mock_bs4_class = sys.modules["bs4"].BeautifulSoup
        mock_soup = MagicMock()
        mock_bs4_class.return_value = mock_soup
        
        # Configure `find_all` to return different lists based on arguments?
        # MagicMock side_effect can be a function
        
        def find_all_side_effect(*args, **kwargs):
            # Check arguments to decide what to return
            # args[0] is the tag name
            tag = args[0] if args else None
            
            if tag == 'a':
                # Return list of mock anchors
                # 1. Mailto
                a1 = MagicMock()
                a1.__getitem__.side_effect = lambda k: "mailto:contact@example.com" if k == 'href' else None
                
                # 2. Social
                a2 = MagicMock()
                a2.__getitem__.side_effect = lambda k: "https://facebook.com/example" if k == 'href' else None
                
                # 3. Privacy
                a3 = MagicMock()
                a3.__getitem__.side_effect = lambda k: "/privacy-policy" if k == 'href' else None
                
                return [a1, a2, a3]
                
            if tag == 'address':
                addr = MagicMock()
                addr.get_text.return_value = "123 Main St, New York, NY 10001"
                return [addr]
                
            return [] # Default empty
            
        mock_soup.find_all.side_effect = find_all_side_effect
        
        # Configure get_text
        mock_soup.get_text.return_value = "Welcome to our site. Privacy Policy. Contact us."
        
        # Run
        state = {"website": "example.com"}
        result = run_trust_scanner(state)
        
        # Verify
        # 1. Hidden emails
        self.assertIn("contact@example.com", result['full_site_text'])
        self.assertIn("[HIDDEN EMAILS]", result['full_site_text'])
        
        # 2. Socials
        self.assertIn("https://facebook.com/example", result['social_links'])
        
        # 3. Legitimacy
        # "privacy policy" in text or href
        self.assertTrue(result['legitimacy_signals']['has_privacy_policy'])
        
        # 4. Address
        self.assertEqual(result['address'], "123 Main St, New York, NY 10001")

if __name__ == '__main__':
    unittest.main()


