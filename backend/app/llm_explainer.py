from __future__ import annotations
from groq import Groq
from .config import settings
from .models import CaseFacts, RuleOutcome


def build_prompt(facts: CaseFacts, outcome: RuleOutcome, chunks: list[dict]) -> str:
    chunk_text = "\n\n".join(
        f"- {c['doc_id']} {c['version']} ({c['status']}) — {c['section']}:\n{c['text'][:400]}"
        for c in chunks
    )
    return f"""CASE FACTS:
Learner: {facts.learner_name}
Question: {facts.question}
Attendance: {facts.attendance_pct}
Live sessions: {facts.live_sessions}
Capstone score: {facts.capstone_score}
Medical note offered: {facts.medical_note_offered}
Medical note verified: {facts.medical_note_verified}
Submission safe: {facts.submission_safe}
Extension requested: {facts.extension_requested}
Extension approved: {facts.extension_approved}

RULE OUTCOME (already computed — do NOT change):
Recommendation: {outcome.recommendation}
Status: {outcome.status}
Blockers: {'; '.join(outcome.blockers) or 'none'}
Missing facts: {', '.join(outcome.missing_facts) or 'none'}

RELEVANT POLICY EXCERPTS:
{chunk_text}

TASK: Write a concise explanation (max 200 words) for the coordinator that:
1. States the recommendation clearly
2. Explains which rules passed or failed and why
3. Cites source IDs and versions (e.g., KB-01 v2)
4. Lists missing facts or pending approvals
5. Ends with ONE next action

Use ONLY the provided excerpts. Do not invent policy. Do not change the outcome."""


def explain(facts: CaseFacts, outcome: RuleOutcome, chunks: list[dict]) -> tuple[str | None, str | None]:
    """Returns (explanation, error)."""
    if not settings.GROQ_API_KEY:
        return None, "LLM unavailable: GROQ_API_KEY not configured."

    try:
        client = Groq(api_key=settings.GROQ_API_KEY)
        response = client.chat.completions.create(
            model=settings.GROQ_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a policy explanation assistant for SkillBridge coordinators. "
                        "You explain rule outcomes. You do NOT decide eligibility. "
                        "Use ONLY the provided policy excerpts. Cite source IDs and versions."
                    ),
                },
                {"role": "user", "content": build_prompt(facts, outcome, chunks)},
            ],
            temperature=0.2,
            max_tokens=500,
        )
        return response.choices[0].message.content, None
    except Exception as e:
        return None, f"LLM temporarily unavailable: {type(e).__name__}"