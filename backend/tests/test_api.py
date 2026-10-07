from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_nadia_case_returns_pending_waiting_for_mentor():
    payload = {
        "learner_name": "Nadia",
        "question": "Can I still receive a certificate? Can I submit one day late?",
        "attendance_pct": 76,
        "live_sessions": 2,
        "capstone_score": None,
        "medical_note_offered": True,
        "medical_note_verified": False,
        "submission_safe": None,
        "extension_requested": True,
        "extension_request_time": "2026-10-07T11:00:00",
        "extension_approved": False,
    }
    r = client.post("/api/cases/analyze", json=payload)
    assert r.status_code == 200
    data = r.json()
    assert data["recommendation"] == "pending"
    assert data["status"] == "Waiting for Mentor"
    doc_ids = [c["doc_id"] for c in data["citations"]]
    assert "KB-01" in doc_ids
    assert "KB-02" in doc_ids


def test_invalid_attendance_is_rejected():
    payload = {
        "learner_name": "Bad",
        "question": "Am I eligible?",
        "attendance_pct": 140,
    }
    r = client.post("/api/cases/analyze", json=payload)
    assert r.status_code == 422


def test_sara_gets_superseded_citation():
    payload = {
        "learner_name": "Sara",
        "question": "A colleague said 60 is enough to pass. Am I eligible?",
        "attendance_pct": 85,
        "live_sessions": 3,
        "capstone_score": 65,
        "submission_safe": True,
    }
    r = client.post("/api/cases/analyze", json=payload)
    assert r.status_code == 200
    data = r.json()
    assert data["recommendation"] == "ineligible"
    doc_ids = [c["doc_id"] for c in data["citations"]]
    assert "KB-05" in doc_ids
    kb05 = [c for c in data["citations"] if c["doc_id"] == "KB-05"][0]
    assert kb05["status"] == "SUPERSEDED"