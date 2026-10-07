from __future__ import annotations
from pydantic import BaseModel, Field, field_validator
from typing import Optional, Literal
from datetime import datetime


class CaseFacts(BaseModel):
    learner_name: str
    question: str
    attendance_pct: Optional[float] = None
    live_sessions: Optional[int] = None
    capstone_score: Optional[float] = None
    medical_note_offered: bool = False
    medical_note_verified: bool = False
    submission_safe: Optional[bool] = None
    extension_requested: bool = False
    extension_request_time: Optional[datetime] = None
    extension_approved: bool = False
    makeup_requested: bool = False
    makeup_approved: bool = False
    missed_session_date: Optional[datetime] = None
    case_date: datetime = Field(default_factory=lambda: datetime(2026, 10, 7, 11, 0))

    @field_validator("attendance_pct")
    @classmethod
    def validate_attendance(cls, v):
        if v is not None and (v < 0 or v > 100):
            raise ValueError("attendance_pct must be between 0 and 100")
        return v

    @field_validator("capstone_score")
    @classmethod
    def validate_score(cls, v):
        if v is not None and (v < 0 or v > 100):
            raise ValueError("capstone_score must be between 0 and 100")
        return v

    @field_validator("live_sessions")
    @classmethod
    def validate_sessions(cls, v):
        if v is not None and v < 0:
            raise ValueError("live_sessions cannot be negative")
        return v


class CheckResult(BaseModel):
    passed: Optional[bool]
    actual: Optional[float] = None
    required: Optional[float] = None
    source: str = ""


class Citation(BaseModel):
    doc_id: str
    version: str
    status: str
    section: str


class RuleOutcome(BaseModel):
    recommendation: Literal["eligible", "ineligible", "pending", "on_hold"]
    status: Literal[
        "Open", "Waiting for Learner", "Waiting for Mentor",
        "Ready for Review", "Closed"
    ]
    attendance_check: CheckResult
    session_check: CheckResult
    capstone_check: CheckResult
    submission_check: CheckResult
    extension_check: CheckResult
    blockers: list[str] = []
    missing_facts: list[str] = []
    next_action: str = ""
    citations: list[Citation] = []


class CaseResponse(BaseModel):
    case_id: int
    learner_name: str
    question: str
    recommendation: str
    status: str
    rule_outcome: RuleOutcome
    llm_explanation: Optional[str] = None
    llm_error: Optional[str] = None
    citations: list[Citation]
    missing_facts: list[str]
    next_action: str
    created_at: datetime


class CaseListItem(BaseModel):
    id: int
    learner_name: str
    question: str
    status: str
    recommendation: str
    created_at: datetime


class NoteRequest(BaseModel):
    note: str