import re
import httpx
from bs4 import BeautifulSoup, XMLParsedAsHTMLWarning
import warnings
from groq import Groq
from ..config import get_settings

# Suppress XML parsing warning
warnings.filterwarnings('ignore', category=XMLParsedAsHTMLWarning)

# Common legal/boilerplate phrases to filter out
LEGAL_PATTERNS = [
    r"forward.looking statement",
    r"safe harbor",
    r"this (press release|report|filing) (contains|includes|may contain)",
    r"(we|the company) (caution|advise|warn)",
    r"actual results (may|could|might) differ",
    r"(undue reliance|no obligation to update)",
    r"(hereby|herein|thereof|thereto|hereof|wherein|foregoing)",
    r"pursuant to (section|rule|regulation)",
    r"(exhibit|signature|power of attorney)",
    r"(incorporated by reference)",
    r"registrant.s telephone",
    r"commission file number",
    r"emerging growth company",
    r"check the appropriate box",
    r"indicate by check mark",
    r"(furnished|filed) herewith",
    r"^\s*\(?\d+\)?\s*$",  # Just numbers in parentheses
]

# Sections to skip entirely
SKIP_SECTIONS = [
    "risk factors",
    "forward-looking statements",
    "legal proceedings",
    "signatures",
    "exhibit index",
    "certifications",
    "power of attorney",
    "cautionary note",
    "safe harbor statement",
]

# Patterns indicating XBRL/XML metadata to skip
XBRL_PATTERNS = [
    r"^https?://",  # URLs
    r"^http://",
    r"fasb\.org",
    r"xbrl",
    r"^iso\d+:",
    r"^[a-z]+:[A-Z]",  # namespace:Element patterns
    r"^\d{10}$",  # CIK numbers alone
    r"^\d{4}-\d{2}-\d{2}$",  # Dates alone
    r"^0+\d+$",  # Zero-padded numbers
    r"Member$",
    r"^dei:",
    r"^us-gaap:",
]

# 8-K Item descriptions for better context
ITEM_8K_DESCRIPTIONS = {
    "1.01": "Entry into a Material Definitive Agreement",
    "1.02": "Termination of a Material Definitive Agreement",
    "1.03": "Bankruptcy or Receivership",
    "2.01": "Completion of Acquisition or Disposition of Assets",
    "2.02": "Results of Operations and Financial Condition",
    "2.03": "Creation of a Direct Financial Obligation",
    "2.04": "Triggering Events That Accelerate or Increase a Direct Financial Obligation",
    "2.05": "Costs Associated with Exit or Disposal Activities",
    "2.06": "Material Impairments",
    "3.01": "Notice of Delisting or Failure to Satisfy a Continued Listing Rule",
    "3.02": "Unregistered Sales of Equity Securities",
    "3.03": "Material Modification to Rights of Security Holders",
    "4.01": "Changes in Registrant's Certifying Accountant",
    "4.02": "Non-Reliance on Previously Issued Financial Statements",
    "5.01": "Changes in Control of Registrant",
    "5.02": "Departure/Election of Directors or Officers; Compensatory Arrangements",
    "5.03": "Amendments to Articles of Incorporation or Bylaws",
    "5.07": "Submission of Matters to a Vote of Security Holders",
    "7.01": "Regulation FD Disclosure",
    "8.01": "Other Events",
    "9.01": "Financial Statements and Exhibits",
}


class SummarizerService:
    """Service for generating AI summaries of SEC filings using Groq."""

    def __init__(self):
        settings = get_settings()
        self.client = Groq(api_key=settings.groq_api_key)
        self.model = settings.groq_model

    async def fetch_filing_text(self, url: str, max_chars: int = 15000) -> str:
        """Fetch and extract clean text content from a filing document."""
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers={
                "User-Agent": "StockDDFinder contact@example.com"
            }, timeout=30.0)
            response.raise_for_status()
            html = response.text

        # Parse HTML and extract text
        soup = BeautifulSoup(html, 'lxml')

        # Remove script, style, and other non-content elements
        for tag in soup(['script', 'style', 'meta', 'link', 'header', 'footer', 'nav', 'ix:hidden']):
            tag.decompose()

        # Get text content
        text = soup.get_text(separator='\n')

        # Clean up the text
        text = self._clean_text(text)

        # Try to fetch exhibit/press release if main filing is sparse
        # This is common for 8-K filings where the actual content is in an exhibit
        if len(text) < 2000:
            exhibit_text = await self._try_fetch_8k_exhibit(url, client if hasattr(client, 'get') else None)
            if exhibit_text:
                text = text + "\n\n--- PRESS RELEASE / EXHIBIT ---\n\n" + exhibit_text

        return text[:max_chars]

    async def _try_fetch_8k_exhibit(self, filing_url: str, client=None) -> str:
        """Try to fetch the press release exhibit for an 8-K filing."""
        try:
            # Get the base directory of the filing
            base_url = filing_url.rsplit('/', 1)[0]

            async with httpx.AsyncClient() as http_client:
                # Get the filing index to find exhibits
                index_url = base_url + '/'
                try:
                    index_response = await http_client.get(index_url, headers={
                        "User-Agent": "StockDDFinder research@example.com"
                    }, timeout=15.0)

                    if index_response.status_code == 200:
                        # Look for exhibit links in the index
                        index_soup = BeautifulSoup(index_response.text, 'lxml')
                        for link in index_soup.find_all('a', href=True):
                            href = link['href']
                            href_lower = href.lower()

                            # Look for exhibit 99 files (press releases) - must be .htm files in this filing's directory
                            is_exhibit = (
                                '99' in href_lower and
                                href_lower.endswith(('.htm', '.html')) and
                                base_url.split('/')[-1] in href  # Must be in this filing's directory
                            )

                            # Skip the main filing itself, index files, and images
                            is_main_filing = (
                                filing_url.split('/')[-1].lower() in href_lower or
                                'index' in href_lower or
                                href_lower.endswith(('.xml', '.xsd', '.json', '.zip', '.jpg', '.png', '.gif'))
                            )

                            if is_exhibit and not is_main_filing:
                                # Construct full URL
                                if href.startswith('http'):
                                    exhibit_url = href
                                elif href.startswith('/'):
                                    exhibit_url = 'https://www.sec.gov' + href
                                else:
                                    exhibit_url = base_url + '/' + href

                                content = await self._fetch_exhibit_content(http_client, exhibit_url)
                                if content and len(content) > 500:
                                    return content
                except Exception as e:
                    pass

        except Exception as e:
            pass  # Silently fail - we'll just use the main filing text

        return ""

    async def _fetch_exhibit_content(self, client, url: str) -> str:
        """Fetch and clean exhibit content."""
        try:
            response = await client.get(url, headers={
                "User-Agent": "StockDDFinder contact@example.com"
            }, timeout=15.0)

            if response.status_code != 200:
                return ""

            soup = BeautifulSoup(response.text, 'lxml')

            for tag in soup(['script', 'style', 'meta', 'link']):
                tag.decompose()

            text = soup.get_text(separator='\n')
            text = self._clean_text(text)

            # Only return if we got meaningful content
            if len(text) > 500:
                return text[:8000]  # Limit exhibit size

        except:
            pass

        return ""

    def _is_xbrl_or_metadata(self, line: str) -> bool:
        """Check if a line is XBRL/XML metadata."""
        line_stripped = line.strip()

        for pattern in XBRL_PATTERNS:
            if re.search(pattern, line_stripped, re.IGNORECASE):
                return True

        # Skip lines that are just identifiers or codes
        if re.match(r'^[a-z0-9\-:/_\.]+$', line_stripped, re.IGNORECASE) and len(line_stripped) < 100:
            return True

        return False

    def _clean_text(self, text: str) -> str:
        """Clean and filter text to remove boilerplate and legal jargon."""
        lines = text.split('\n')
        cleaned_lines = []
        skip_section = False
        seen_content = set()  # Deduplicate repeated lines

        for line in lines:
            line = line.strip()

            # Skip empty lines
            if not line:
                continue

            # Skip very short lines (often headers/page numbers)
            if len(line) < 15:
                continue

            # Skip XBRL/XML metadata
            if self._is_xbrl_or_metadata(line):
                continue

            # Skip duplicate lines
            line_normalized = re.sub(r'\s+', ' ', line.lower())
            if line_normalized in seen_content:
                continue
            seen_content.add(line_normalized)

            # Check if we're entering a section to skip
            line_lower = line.lower()
            if any(section in line_lower for section in SKIP_SECTIONS):
                skip_section = True
                continue

            # Check if we're in a new major section (reset skip)
            if re.match(r'^(item\s+\d|part\s+[iv]+)', line_lower):
                skip_section = False

            if skip_section:
                continue

            # Skip lines that are mostly legal boilerplate
            if self._is_legal_boilerplate(line):
                continue

            # Skip lines that are just repeated characters or formatting
            if re.match(r'^[\s\-_=*#\.]+$', line):
                continue

            # Skip lines that look like table of contents entries
            if re.match(r'^.{1,50}\s*\.{3,}\s*\d+\s*$', line):
                continue

            cleaned_lines.append(line)

        # Join and normalize whitespace
        text = '\n'.join(cleaned_lines)
        text = re.sub(r'\n{3,}', '\n\n', text)
        text = re.sub(r' {2,}', ' ', text)

        return text

    def _is_legal_boilerplate(self, text: str) -> bool:
        """Check if a line is legal boilerplate."""
        text_lower = text.lower()

        for pattern in LEGAL_PATTERNS:
            if re.search(pattern, text_lower):
                return True

        return False

    def _extract_8k_items(self, text: str) -> str:
        """Extract the specific 8-K items mentioned and add context."""
        items_found = []

        for item_num, description in ITEM_8K_DESCRIPTIONS.items():
            pattern = rf"item\s+{re.escape(item_num)}"
            if re.search(pattern, text, re.IGNORECASE):
                items_found.append(f"Item {item_num}: {description}")

        if items_found:
            return "8-K Items reported: " + "; ".join(items_found) + "\n\n"
        return ""

    def _get_form_specific_prompt(self, form_type: str, company_name: str, filing_text: str) -> str:
        """Get a prompt tailored to the specific form type."""

        if form_type == "8-K":
            items_context = self._extract_8k_items(filing_text)
            return f"""Summarize this {company_name} current report (8-K).

{items_context}Based on the filing content, provide a specific summary that answers:
- What exactly happened or was announced?
- What are the specific details (numbers, names, dates, terms)?
- Why does this matter for investors?

If this is an earnings announcement, include: revenue, net income, EPS, and any guidance.
If this is an agreement, include: parties involved, deal value, key terms.
If this is a leadership change, include: who is leaving/joining and their role.

Do NOT give a generic summary like "filed an 8-K" or "announced an update".
Extract the ACTUAL news from the filing."""

        prompts = {
            "10-K": f"""Summarize this {company_name} annual report (10-K).
Extract these specific numbers:
- Total annual revenue and YoY % change
- Net income/loss and YoY % change
- Gross margin or operating margin if mentioned
- Any 2026 guidance or outlook

Be specific with dollar amounts and percentages.""",

            "10-Q": f"""Summarize this {company_name} quarterly report (10-Q).
Extract these specific numbers:
- Quarterly revenue and YoY % change
- Net income/loss for the quarter
- Any notable segment performance
- Changes to guidance if mentioned

Be specific with dollar amounts and percentages.""",

            "4": f"""Summarize this {company_name} Form 4 insider trading report.
Extract exactly:
- Full name and title of the insider
- Transaction type: Purchase, Sale, or Grant
- Number of shares transacted
- Price per share (or if it was a gift/grant at $0)
- Total transaction value
- Shares now owned after transaction

Example format: "[Name], [Title], [bought/sold] [X shares] at $[Y] per share ($[total value])." """,

            "DEF 14A": f"""Summarize this {company_name} proxy statement (DEF 14A).
Focus on:
- CEO total compensation package value
- Any notable shareholder proposals and board recommendations
- Executive bonuses or equity grants
- Board election matters

Include specific dollar amounts for compensation.""",
        }

        return prompts.get(form_type, f"""Summarize this {company_name} SEC filing ({form_type}).
Focus on the key facts, specific numbers, and material information.
Be concrete and specific - avoid generic statements.""")

    def generate_headline(
        self,
        form_type: str,
        company_name: str,
        filing_text: str,
    ) -> str:
        """Generate a 1-3 sentence headline summarizing the filing."""

        form_prompt = self._get_form_specific_prompt(form_type, company_name, filing_text)

        prompt = f"""{form_prompt}

Create a 1-3 sentence summary with SPECIFIC facts and numbers.
Do NOT use phrases like "filed a report", "announced an update", or "disclosed information".
Instead, state WHAT was announced with concrete details.

Filing content:
{filing_text[:12000]}

Respond with ONLY the factual summary. No preamble."""

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=300,
            temperature=0.1,  # Very low for factual extraction
        )

        headline = response.choices[0].message.content.strip()

        # Clean up any remaining preamble
        headline = re.sub(r'^(here is|this filing|summary:|the filing|this 8-k)\s*:?\s*', '', headline, flags=re.IGNORECASE)

        # Remove quotes if the whole thing is quoted
        if headline.startswith('"') and headline.endswith('"'):
            headline = headline[1:-1]

        return headline

    def get_form_type_description(self, form_type: str) -> str:
        """Get a human-readable description of an SEC form type."""
        descriptions = {
            "10-K": "Annual Report",
            "10-Q": "Quarterly Report",
            "8-K": "Current Report (Material Event)",
            "4": "Insider Trading",
            "S-1": "IPO Registration",
            "S-3": "Shelf Registration",
            "DEF 14A": "Proxy Statement",
            "13F": "Institutional Holdings",
            "SC 13G": "Beneficial Ownership (Passive)",
            "SC 13D": "Beneficial Ownership (Active)",
            "424B": "Prospectus",
            "6-K": "Foreign Company Report",
            "20-F": "Foreign Company Annual Report",
        }
        return descriptions.get(form_type, form_type)
