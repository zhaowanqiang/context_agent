"""FastAPI 服务：把 steps.py 的无状态步骤暴露给本地 Next.js 后台。

只做 LLM 步骤，不碰数据库、不写 runs/ 目录（Web 模式产物由 Next.js 落 Supabase）。
启动：uvicorn contentagent.server:app --host 127.0.0.1 --port 8600
"""

from typing import Literal

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from . import config, llm, steps, tracks
from .errors import (
    ConfigError,
    ContentAgentError,
    LLMAPIError,
    LLMConnectionError,
    LLMTimeoutError,
)

app = FastAPI(title="contentagent", docs_url=None, redoc_url=None)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

TrackId = Literal["x", "wechat"]


# ── 异常 → HTTP 状态码 ───────────────────────────────────────────────

_STATUS = {
    ConfigError: (500, "config"),
    LLMAPIError: (502, "api_error"),
    LLMTimeoutError: (504, "timeout"),
    LLMConnectionError: (502, "connection"),
}


@app.exception_handler(ContentAgentError)
async def _handle_agent_error(request: Request, exc: ContentAgentError):
    status, kind = _STATUS.get(type(exc), (500, "unknown"))
    return JSONResponse(
        status_code=status,
        content={"detail": {"type": kind, "message": str(exc)}},
    )


# ── 请求/响应模型 ────────────────────────────────────────────────────

class OutlineReq(BaseModel):
    track: TrackId
    material: str = Field(min_length=1)


class DraftReq(BaseModel):
    track: TrackId
    outline: str = Field(min_length=1)


class GateReq(BaseModel):
    track: TrackId
    draft: str = Field(min_length=1)
    material: str = ""  # 实测声明核查用；空则该项核查退化


class ReviewReq(BaseModel):
    track: TrackId
    draft: str = Field(min_length=1)


class TopicItem(BaseModel):
    id: str
    title: str
    summary: str = ""


class ScoreReq(BaseModel):
    track: TrackId
    items: list[TopicItem] = Field(min_length=1, max_length=20)
    recent_titles: list[str] = []  # 查重：最近已用/候选的选题标题


class BriefingTopic(BaseModel):
    name: str
    keywords: str = ""
    note: str = ""


class BriefingCandidate(BaseModel):
    topic: str
    title: str
    link: str
    source: str = ""
    published: str = ""
    summary: str = ""


class BriefingReq(BaseModel):
    date: str = Field(min_length=1)  # YYYY-MM-DD，简报「今天」
    topics: list[BriefingTopic] = Field(min_length=1)
    candidates: list[BriefingCandidate] = Field(min_length=1, max_length=120)


class XPostReq(BaseModel):
    item: str = Field(min_length=1)  # 简报选题文本（摘要/链接/理由）


def _call_payload(c: llm.LLMCall) -> dict:
    return {
        "step": c.step,
        "model": c.model,
        "prompt": c.prompt,
        "response": c.response,
        "input_tokens": c.usage.get("input_tokens", 0),
        "output_tokens": c.usage.get("output_tokens", 0),
    }


# ── 端点 ─────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status": "ok",
        "provider": config.PROVIDER,
        "strong_model": config.STRONG_MODEL,
        "gate_model": config.GATE_MODEL,
        "tracks": list(tracks.TRACKS),
    }


@app.post("/steps/outline")
def step_outline(req: OutlineReq):
    c = steps.generate_outline(req.track, req.material)
    return {"text": c.response, "call": _call_payload(c)}


@app.post("/steps/draft")
def step_draft(req: DraftReq):
    c = steps.generate_draft(req.track, req.outline)
    return {"text": c.response, "call": _call_payload(c)}


@app.post("/steps/gate")
def step_gate(req: GateReq):
    c = steps.run_gate(req.track, req.draft, req.material)
    return {"text": c.response, "call": _call_payload(c)}


@app.post("/steps/review")
def step_review(req: ReviewReq):
    review, c = steps.review_draft(req.track, req.draft)
    return {"review": review, "call": _call_payload(c)}


@app.post("/topics/score")
def topics_score(req: ScoreReq):
    scores, c = steps.score_topics(req.track, [i.model_dump() for i in req.items], req.recent_titles)
    return {"scores": scores, "call": _call_payload(c)}


@app.post("/steps/xpost")
def step_xpost(req: XPostReq):
    c = steps.generate_xpost(req.item)
    return {"text": c.response, "call": _call_payload(c)}


@app.post("/steps/briefing")
def step_briefing(req: BriefingReq):
    c = steps.generate_briefing(
        req.date,
        [t.model_dump() for t in req.topics],
        [i.model_dump() for i in req.candidates],
    )
    return {"text": c.response, "call": _call_payload(c)}
