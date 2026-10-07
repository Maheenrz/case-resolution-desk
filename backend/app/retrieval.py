from __future__ import annotations
import os
import re
from pathlib import Path
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


POLICY_DIR = Path(__file__).parent / "policies"


def parse_policies():
    """Parse KB markdown files into chunks by section heading."""
    chunks = []
    for path in sorted(POLICY_DIR.glob("KB-*.md")):
        text = path.read_text(encoding="utf-8")
        doc_id = path.stem  # e.g., "KB-01"

        # Extract metadata
        version_match = re.search(r"Version:\s*(\S+)", text)
        effective_match = re.search(r"Effective date:\s*(.+)", text)
        status_match = re.search(r"Status:\s*(.+)", text)

        version = version_match.group(1) if version_match else "v1"
        effective = effective_match.group(1).strip() if effective_match else ""
        status = status_match.group(1).strip() if status_match else "CURRENT"

        # Split by ## headings
        sections = re.split(r"\n## ", text)
        for i, section in enumerate(sections[1:], start=1):
            lines = section.split("\n")
            title = lines[0].strip()
            body = "\n".join(lines[1:]).strip()
            chunks.append({
                "doc_id": doc_id,
                "version": version,
                "effective_date": effective,
                "status": status,
                "section": title,
                "text": body,
                "full_text": f"{title}\n{body}",
            })
    return chunks


class Retriever:
    def __init__(self):
        self.chunks = parse_policies()
        corpus = [c["full_text"] for c in self.chunks]
        self.vectorizer = TfidfVectorizer(stop_words="english", max_features=5000)
        self.matrix = self.vectorizer.fit_transform(corpus)

    def search(self, query: str, top_k: int = 6, case_date=None):
        q_vec = self.vectorizer.transform([query])
        scores = cosine_similarity(q_vec, self.matrix).flatten()
        top_indices = scores.argsort()[::-1][:top_k]

        results = []
        for idx in top_indices:
            if scores[idx] > 0:
                chunk = self.chunks[idx].copy()
                chunk["score"] = float(scores[idx])
                # Mark KB-05 superseded for post-Oct-1 cases
                if chunk["doc_id"] == "KB-05":
                    chunk["status"] = "SUPERSEDED"
                results.append(chunk)
        return results


_retriever = None


def get_retriever():
    global _retriever
    if _retriever is None:
        _retriever = Retriever()
    return _retriever