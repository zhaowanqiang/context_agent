"""无状态步骤函数：CLI pipeline 与 FastAPI server 的共同底座。

每个函数一进一出，不 print、不碰 runs/ 目录、不持有跨调用状态。
"""

import json
import re

from . import config, llm, loader, tracks


def generate_outline(track_id: str, material: str) -> llm.LLMCall:
    """Hop 1：素材 → 大纲（强模型 + thinking）。"""
    t = tracks.get_track(track_id)
    style = loader.load_style(t)
    prompt = t["prompts"]["outline"].format(
        redline=t["redline"], style=style, material=material,
    )
    return llm.call("hop1_outline", prompt,
                    config.STRONG_MODEL, t["max_tokens"]["outline"], thinking=True)


def generate_draft(track_id: str, outline: str) -> llm.LLMCall:
    """Hop 2：（人工确认后的）大纲 + few-shot → 成稿（强模型 + thinking）。"""
    t = tracks.get_track(track_id)
    style = loader.load_style(t)
    fewshot = loader.load_fewshot(t)
    prompt = t["prompts"]["draft"].format(
        redline=t["redline"], style=style, fewshot=fewshot, outline=outline,
    )
    # 大纲末尾若带「（成稿要求：…）」（如 GitHub 库短篇推介的字数限制），
    # 只放在长 prompt 末尾权重不够会被无视——顶格注入开头作为最高优先级指令
    m = re.search(r"（成稿要求：[^）]*）", outline)
    if m:
        prompt = (
            f"【本篇硬性要求 · 优先级最高，覆盖下方一切默认篇幅/结构】\n{m.group(0)}\n"
            f"字数指的是正文总字数，超出即不合格。\n\n{prompt}"
        )
    c = llm.call("hop2_draft", prompt,
                 config.STRONG_MODEL, t["max_tokens"]["draft"], thinking=True)
    if track_id == "wechat":
        # 引号规范双保险：prompt 已要求“”，这里兜底把漏网的「」统一掉
        c.response = c.response.replace("「", "“").replace("」", "”")
    return c


def run_gate(track_id: str, draft: str, material: str = "") -> llm.LLMCall:
    """Gate：成稿 → 红线检查 +（公众号轨道）实测声明核查 + 待核实清单（小模型省钱）。

    material 用于核查成稿里的第一人称实测声明是否有素材依据；
    X 轨道模板暂无 {material} 槽位，多余参数会被 format 忽略。
    """
    t = tracks.get_track(track_id)
    prompt = t["prompts"]["gate"].format(redline=t["redline"], draft=draft, material=material)
    return llm.call("gate_factcheck", prompt,
                    config.GATE_MODEL, t["max_tokens"]["gate"])


def _parse_json(step: str, text: str):
    """解析模型输出的 JSON；剥一层 ``` 围栏后重试一次。"""
    from .errors import LLMAPIError
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        stripped = text.strip()
        if stripped.startswith("```"):
            stripped = stripped.split("\n", 1)[-1].rsplit("```", 1)[0]
            try:
                return json.loads(stripped)
            except json.JSONDecodeError:
                pass
        raise LLMAPIError(f"[{step}] 模型输出不是合法 JSON：{text[:200]}")


def review_draft(track_id: str, draft: str) -> tuple[dict, llm.LLMCall]:
    """成稿质检：对照风格指纹打质量分（小模型省钱）。

    返回 ({"score": float, "problems": [str], "better_title": str|None}, call)。
    自动产线用它决定是否带着问题清单重写一次；人工流程只做展示。
    """
    from . import prompts
    from .errors import LLMAPIError
    t = tracks.get_track(track_id)
    style = loader.load_style(t)
    prompt = prompts.REVIEW_PROMPTS[track_id].format(style=style, draft=draft)
    c = llm.call("review_draft", prompt, config.GATE_MODEL, t["max_tokens"]["review"])
    review = _parse_json(("review_draft"), c.response)
    if not isinstance(review, dict) or "score" not in review:
        raise LLMAPIError(f"[review_draft] 输出缺少 score 字段：{c.response[:200]}")
    review.setdefault("problems", [])
    review.setdefault("better_title", None)
    review["score"] = float(review["score"])
    return review, c


def score_topics(track_id: str, items: list[dict],
                 recent_titles: list[str] | None = None) -> tuple[list[dict], llm.LLMCall]:
    """选题打分：RSS 条目列表 → [{id, score, angle, reason}]（小模型省钱）。

    items: [{"id": str, "title": str, "summary": str}]，调用方每批 ≤20 条。
    recent_titles: 最近已用/候选的选题标题 —— 同一事件重复的候选会被打低分。
    """
    from . import prompts
    t = tracks.get_track(track_id)
    prompt = prompts.TOPIC_SCORE_PROMPTS[track_id].format(
        redline=t["redline"],
        recent_titles="\n".join(f"- {t_}" for t_ in (recent_titles or [])) or "（无）",
        items_json=json.dumps(items, ensure_ascii=False, indent=1),
    )
    # 英文候选（Reddit/HN）标题摘要长、angle/reason 要中文，输出预算给足
    c = llm.call("score_topics", prompt, config.GATE_MODEL, 5000)
    return _parse_json(("score_topics"), c.response), c
