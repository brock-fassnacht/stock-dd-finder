import httpx
from groq import Groq
from ..config import get_settings


class SummarizerService:
    """Service for generating AI summaries of SEC filings using Groq."""

    def __init__(self):
        settings = get_settings()
        self.client = Groq(api_key=settings.groq_api_key)
        self.model = "llama-3.1-8b-instant"  # Fast and free

    async def fetch_filing_text(self, url: str, max_chars: int = 10000) -> str:
        """Fetch the text content of a filing document."""
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers={
                "User-Agent": "StockDDFinder contact@example.com"
            }, timeout=30.0)
            response.raise_for_status()
            text = response.text

        return text[:max_chars]

    def generate_headline(
        self,
        form_type: str,
        company_name: str,
        filing_text: str,
        document_url: str,
    ) -> str:
        """Generate a 1-3 sentence headline summarizing the filing."""
        prompt = f"""You are summarizing an SEC {form_type} filing from {company_name}.

Create a brief 1-3 sentence headline that captures the most important point(s) of this filing.
Focus on material events, financial results, or significant disclosures.
Be specific about numbers, dates, and key facts when relevant.
Write in a neutral, factual tone.

Filing content (truncated):
{filing_text[:8000]}

Respond with ONLY the headline summary, nothing else."""

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=200,
            temperature=0.3,
        )

        headline = response.choices[0].message.content.strip()
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
