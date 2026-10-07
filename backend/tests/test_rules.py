from app.models import CaseFacts
from app.rules_engine import analyze_case


def test_attendance_below_80_is_ineligible():
    """Confirmed failure with no cure path → ineligible."""
    facts = CaseFacts(
        learner_name="Test",
        question="Am I eligible?",
        attendance_pct=76,
        live_sessions=3,
        capstone_score=75,
        submission_safe=True,
    )
    outcome = analyze_case(facts)
    assert outcome.attendance_check.passed is False
    assert outcome.recommendation == "ineligible"


def test_unknown_attendance_is_pending():
    """Unknown value must not be coerced."""
    facts = CaseFacts(
        learner_name="Test",
        question="Am I eligible?",
        attendance_pct=None,
        live_sessions=3,
        capstone_score=75,
        submission_safe=True,
    )
    outcome = analyze_case(facts)
    assert outcome.recommendation == "pending"
    assert outcome.status == "Waiting for Learner"
    assert "attendance_pct" in outcome.missing_facts


def test_submission_secret_overrides_good_numbers():
    """KB-03 hold beats passing numbers."""
    facts = CaseFacts(
        learner_name="Hamza",
        question="Am I eligible?",
        attendance_pct=82,
        live_sessions=3,
        capstone_score=78,
        submission_safe=False,
    )
    outcome = analyze_case(facts)
    assert outcome.recommendation == "on_hold"
    assert outcome.submission_check.passed is False