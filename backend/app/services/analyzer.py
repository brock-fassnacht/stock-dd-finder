import anthropic
from typing import Optional
from dataclasses import dataclass
from ..config import get_settings


@dataclass
class PostSummary:
    summary: str
    key_points: list[str]


@dataclass
class QualityScores:
    methodology_score: float
    sources_score: float
    reasoning_score: float
    objectivity_score: float
    overall_score: float
    feedback: str


class AnalyzerService:
    def __init__(self):
        settings = get_settings()
        self.client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        self.model = "claude-sonnet-4-20250514"

    def summarize_post(self, title: str, body: str) -> PostSummary:
        """Generate a summary of a Reddit post."""
        prompt = f"""Summarize this stock research post from Reddit. Provide:
1. A concise 2-3 sentence summary of the main thesis
2. A list of 3-5 key points or claims made

Title: {title}

Content:
{body[:8000]}  # Truncate very long posts

Respond in this exact format:
SUMMARY:
[Your 2-3 sentence summary]

KEY POINTS:
- [Point 1]
- [Point 2]
- [Point 3]
"""

        message = self.client.messages.create(
            model=self.model,
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}]
        )

        response_text = message.content[0].text

        # Parse the response
        summary = ""
        key_points = []

        if "SUMMARY:" in response_text:
            parts = response_text.split("KEY POINTS:")
            summary_part = parts[0].replace("SUMMARY:", "").strip()
            summary = summary_part

            if len(parts) > 1:
                points_text = parts[1].strip()
                for line in points_text.split("\n"):
                    line = line.strip()
                    if line.startswith("-"):
                        key_points.append(line[1:].strip())

        return PostSummary(summary=summary, key_points=key_points)

    def score_post(self, title: str, body: str) -> QualityScores:
        """Score the quality of research in a Reddit post."""
        prompt = f"""You are evaluating the quality of stock research posted on Reddit.
Score this post on 4 dimensions (1-10 each):

1. **Methodology** (1-10): Does the author use sound analytical methods?
   - DCF analysis, comparable company analysis, technical analysis with clear reasoning
   - High scores: Uses multiple valuation methods, shows calculations
   - Low scores: No methodology, just speculation or hype

2. **Sources** (1-10): Are claims backed by data, filings, credible sources?
   - High scores: Links to SEC filings, earnings reports, reputable data
   - Low scores: No sources, relies on rumors or "trust me bro"

3. **Reasoning** (1-10): Is the logic coherent? Are conclusions supported by evidence?
   - High scores: Clear logical flow from evidence to conclusion
   - Low scores: Jumps to conclusions, logical fallacies, emotional reasoning

4. **Objectivity** (1-10): Does the author acknowledge risks and counterarguments?
   - High scores: Discusses bear case, mentions risks, balanced view
   - Low scores: Pure hopium, dismisses all criticism, cult-like

Title: {title}

Content:
{body[:8000]}

Respond in this EXACT format (numbers only for scores):
METHODOLOGY: [1-10]
SOURCES: [1-10]
REASONING: [1-10]
OBJECTIVITY: [1-10]
FEEDBACK: [2-3 sentences explaining the scores and how the research could improve]
"""

        message = self.client.messages.create(
            model=self.model,
            max_tokens=512,
            messages=[{"role": "user", "content": prompt}]
        )

        response_text = message.content[0].text

        # Parse scores
        scores = {
            "methodology": 5.0,
            "sources": 5.0,
            "reasoning": 5.0,
            "objectivity": 5.0,
        }
        feedback = ""

        for line in response_text.split("\n"):
            line = line.strip()
            if line.startswith("METHODOLOGY:"):
                try:
                    scores["methodology"] = float(line.split(":")[1].strip().split()[0])
                except (ValueError, IndexError):
                    pass
            elif line.startswith("SOURCES:"):
                try:
                    scores["sources"] = float(line.split(":")[1].strip().split()[0])
                except (ValueError, IndexError):
                    pass
            elif line.startswith("REASONING:"):
                try:
                    scores["reasoning"] = float(line.split(":")[1].strip().split()[0])
                except (ValueError, IndexError):
                    pass
            elif line.startswith("OBJECTIVITY:"):
                try:
                    scores["objectivity"] = float(line.split(":")[1].strip().split()[0])
                except (ValueError, IndexError):
                    pass
            elif line.startswith("FEEDBACK:"):
                feedback = line.split(":", 1)[1].strip()

        # Calculate overall score (weighted average scaled to 100)
        # Methodology and Reasoning weighted slightly higher
        weights = {
            "methodology": 0.3,
            "sources": 0.2,
            "reasoning": 0.3,
            "objectivity": 0.2,
        }

        weighted_sum = sum(scores[k] * weights[k] for k in scores)
        overall = weighted_sum * 10  # Scale from 1-10 to 1-100

        return QualityScores(
            methodology_score=scores["methodology"],
            sources_score=scores["sources"],
            reasoning_score=scores["reasoning"],
            objectivity_score=scores["objectivity"],
            overall_score=round(overall, 1),
            feedback=feedback,
        )

    def analyze_post(self, title: str, body: str) -> tuple[PostSummary, QualityScores]:
        """Run full analysis: summarize and score a post."""
        summary = self.summarize_post(title, body)
        scores = self.score_post(title, body)
        return summary, scores
