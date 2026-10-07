from __future__ import annotations
from datetime import datetime
from .models import CaseFacts, RuleOutcome, CheckResult, Citation

DEADLINE = datetime(2026, 10, 9, 17, 0)


def check_attendance(facts: CaseFacts) -> CheckResult:
    if facts.attendance_pct is None:
        return CheckResult(passed=None, actual=None, required=80, source="KB-01 v2")
    return CheckResult(
        passed=facts.attendance_pct >= 80,
        actual=facts.attendance_pct,
        required=80,
        source="KB-01 v2",
    )


def check_sessions(facts: CaseFacts) -> CheckResult:
    if facts.live_sessions is None:
        return CheckResult(passed=None, actual=None, required=3, source="KB-01 v2")
    return CheckResult(
        passed=facts.live_sessions >= 3,
        actual=facts.live_sessions,
        required=3,
        source="KB-01 v2",
    )


def check_capstone(facts: CaseFacts) -> CheckResult:
    if facts.capstone_score is None:
        return CheckResult(passed=None, actual=None, required=70, source="KB-02 v3")
    return CheckResult(
        passed=facts.capstone_score >= 70,
        actual=facts.capstone_score,
        required=70,
        source="KB-02 v3",
    )


def check_submission(facts: CaseFacts) -> CheckResult:
    if facts.submission_safe is None:
        return CheckResult(passed=None, actual=None, source="KB-03 v2")
    return CheckResult(
        passed=facts.submission_safe,
        actual=1 if facts.submission_safe else 0,
        source="KB-03 v2",
    )


def check_extension(facts: CaseFacts) -> CheckResult:
    if not facts.extension_requested:
        return CheckResult(passed=None, actual=0, source="KB-02 v3")

    if facts.extension_approved:
        return CheckResult(passed=True, actual=1, source="KB-02 v3")

    # Requested but not approved
    if facts.extension_request_time is None:
        # No timestamp — cannot verify timeliness
        return CheckResult(passed=None, actual=0, source="KB-02 v3")

    if facts.extension_request_time >= DEADLINE:
        return CheckResult(passed=False, actual=0, source="KB-02 v3")

    # Timely request, pending approval
    return CheckResult(passed=None, actual=0, source="KB-02 v3")


def determine_status(
    missing_facts: list[str],
    submission_unsafe: bool,
    needs_mentor: bool,
) -> str:
    # Order per Claude's fix:
    # 1. Unsafe submission → Waiting for Learner
    # 2. Pending mentor approval → Waiting for Mentor
    # 3. Missing facts → Waiting for Learner
    # 4. All clear → Ready for Review
    if submission_unsafe:
        return "Waiting for Learner"
    if needs_mentor:
        return "Waiting for Mentor"
    if missing_facts:
        return "Waiting for Learner"
    return "Ready for Review"


def analyze_case(facts: CaseFacts) -> RuleOutcome:
    attendance = check_attendance(facts)
    sessions = check_sessions(facts)
    capstone = check_capstone(facts)
    submission = check_submission(facts)
    extension = check_extension(facts)

    missing_facts = []
    if attendance.passed is None:
        missing_facts.append("attendance_pct")
    if sessions.passed is None:
        missing_facts.append("live_sessions")
    if capstone.passed is None:
        missing_facts.append("capstone_score")
    if submission.passed is None:
        missing_facts.append("submission_safe")

    blockers = []
    if attendance.passed is False:
        blockers.append(f"Attendance {attendance.actual}% is below the 80% requirement (KB-01 v2).")
    if sessions.passed is False:
        blockers.append(f"Only {sessions.actual} live sessions, need 3 (KB-01 v2).")
    if capstone.passed is False:
        blockers.append(f"Capstone score {capstone.actual} is below the 70 threshold (KB-02 v3).")
    if submission.passed is False:
        blockers.append("Submission contains a secret. On hold until clean (KB-03 v2).")

    # Medical note handling
    if facts.medical_note_offered and not facts.medical_note_verified:
        blockers.append("Medical note offered but not verified. Cannot waive requirements until verified (KB-01 v2).")

    # Extension handling
    needs_mentor = False
    if facts.extension_requested and not facts.extension_approved:
        if facts.extension_request_time is None:
            blockers.append("Extension requested but no timestamp provided. Cannot verify timeliness (KB-02 v3).")
            needs_mentor = True
        elif facts.extension_request_time >= DEADLINE:
            blockers.append("Extension requested at or after the deadline. Not automatically valid; human review needed (KB-02 v3).")
        else:
            blockers.append("Extension requested before deadline but not yet mentor-approved (KB-02 v3).")
            needs_mentor = True

    # Makeup handling
    if facts.makeup_requested and not facts.makeup_approved:
        blockers.append("Makeup session requested but not mentor-approved (KB-01 v2).")
        needs_mentor = True

    # Determine recommendation
    submission_unsafe = submission.passed is False

    if submission_unsafe:
        recommendation = "on_hold"
    elif missing_facts:
        recommendation = "pending"
    elif attendance.passed is False or sessions.passed is False or capstone.passed is False:
        # If there's a pending cure path (unverified note or pending approval), stay pending
        has_cure_path = (
            (facts.medical_note_offered and not facts.medical_note_verified)
            or needs_mentor
        )
        recommendation = "pending" if has_cure_path else "ineligible"
    elif needs_mentor:
        recommendation = "pending"
    else:
        recommendation = "eligible"

    status = determine_status(missing_facts, submission_unsafe, needs_mentor)
    if recommendation == "ineligible":
        status = "Ready for Review"

    # Next action
    actions = []
    if submission_unsafe:
        actions.append("Ask learner to rotate the exposed key, remove it from the package, and submit a clean replacement.")
    if facts.medical_note_offered and not facts.medical_note_verified:
        actions.append("Ask learner to send the medical note for coordinator verification.")
    if needs_mentor:
        actions.append("Send the pending approval request to the mentor.")
    if missing_facts:
        actions.append(f"Ask learner for: {', '.join(missing_facts)}.")
    if not actions and recommendation == "eligible":
        actions.append("All requirements met. Move to Ready for Review for final human confirmation.")
    if not actions and recommendation == "ineligible":
        actions.append("Inform learner of ineligibility and cite the current policy.")

    next_action = " ".join(actions) if actions else "Review the case and determine the next step."
    # Citations (deterministic)
    citations = [
        Citation(doc_id="KB-01", version="v2", status="CURRENT", section="Attendance and certification"),
        Citation(doc_id="KB-02", version="v3", status="CURRENT", section="Capstone policy"),
        Citation(doc_id="KB-03", version="v2", status="CURRENT", section="Submission and security"),
    ]

    # Add KB-05 citation when score is in old range OR question mentions old policy
    q = facts.question.lower()
    if (
        (facts.capstone_score is not None and 60 <= facts.capstone_score < 70)
        or "60" in q
        or "old" in q
        or "colleague" in q
    ):
        citations.append(
            Citation(doc_id="KB-05", version="v1", status="SUPERSEDED", section="Old capstone policy")
        )

    return RuleOutcome(
        recommendation=recommendation,
        status=status,
        attendance_check=attendance,
        session_check=sessions,
        capstone_check=capstone,
        submission_check=submission,
        extension_check=extension,
        blockers=blockers,
        missing_facts=missing_facts,
        next_action=next_action,
        citations=citations,
    )