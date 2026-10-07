from __future__ import annotations
import json
from datetime import datetime
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .models import (
    CaseFacts, RuleOutcome, CaseResponse, CaseListItem, NoteRequest, Citation
)
from .rules_engine import analyze_case
from .retrieval import get_retriever
from .llm_explainer import explain
from .database import init_db, get_session, CaseModel, NoteModel, CitationModel
from .config import settings

app = FastAPI(title="Case Resolution Desk")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

init_db()


@app.get("/health")
def health():
    return {"status": "ok", "llm": "available" if settings.GROQ_API_KEY else "degraded"}


@app.post("/api/cases/analyze", response_model=CaseResponse)
def analyze(facts: CaseFacts, db: Session = Depends(get_session)):
    # 1. Evaluate rules
    outcome = analyze_case(facts)

    # 2. Retrieve policy chunks
    retriever = get_retriever()
    query = f"{facts.question} attendance sessions capstone submission extension"
    chunks = retriever.search(query, top_k=6, case_date=facts.case_date)

    # 3. Explain (with graceful failure)
    explanation, llm_error = explain(facts, outcome, chunks)

    # 4. Persist
    case = CaseModel(
        learner_name=facts.learner_name,
        question=facts.question,
        facts_json=facts.model_dump_json(),
        rule_outcome_json=outcome.model_dump_json(),
        llm_explanation=explanation,
        llm_error=llm_error,
        status=outcome.status,
    )
    db.add(case)
    db.flush()  # get case.id

    for c in outcome.citations:
        db.add(CitationModel(
            case_id=case.id,
            doc_id=c.doc_id,
            version=c.version,
            status=c.status,
            section=c.section,
        ))
    db.commit()
    db.refresh(case)

    return CaseResponse(
        case_id=case.id,
        learner_name=case.learner_name,
        question=case.question,
        recommendation=outcome.recommendation,
        status=outcome.status,
        rule_outcome=outcome,
        llm_explanation=explanation,
        llm_error=llm_error,
        citations=outcome.citations,
        missing_facts=outcome.missing_facts,
        next_action=outcome.next_action,
        created_at=case.created_at,
    )


@app.get("/api/cases", response_model=list[CaseListItem])
def list_cases(db: Session = Depends(get_session)):
    cases = db.query(CaseModel).order_by(CaseModel.created_at.desc()).all()
    items = []
    for c in cases:
        try:
            outcome = json.loads(c.rule_outcome_json)
            rec = outcome.get("recommendation", "pending")
        except Exception:
            rec = "pending"
        items.append(CaseListItem(
            id=c.id,
            learner_name=c.learner_name,
            question=c.question,
            status=c.status,
            recommendation=rec,
            created_at=c.created_at,
        ))
    return items


@app.get("/api/cases/{case_id}")
def get_case(case_id: int, db: Session = Depends(get_session)):
    case = db.query(CaseModel).filter(CaseModel.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    facts = json.loads(case.facts_json)
    outcome = json.loads(case.rule_outcome_json)
    notes = db.query(NoteModel).filter(NoteModel.case_id == case_id).all()

    return {
        "id": case.id,
        "learner_name": case.learner_name,
        "question": case.question,
        "facts": facts,
        "rule_outcome": outcome,
        "llm_explanation": case.llm_explanation,
        "llm_error": case.llm_error,
        "status": case.status,
        "created_at": case.created_at,
        "notes": [{"id": n.id, "note": n.note, "created_at": n.created_at} for n in notes],
    }


@app.post("/api/cases/{case_id}/notes")
def add_note(case_id: int, req: NoteRequest, db: Session = Depends(get_session)):
    case = db.query(CaseModel).filter(CaseModel.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    note = NoteModel(case_id=case_id, note=req.note)
    db.add(note)
    db.commit()
    db.refresh(note)
    return {"id": note.id, "case_id": case_id, "note": note.note, "created_at": note.created_at}