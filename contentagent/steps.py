"""无状态步骤函数：CLI pipeline 与 FastAPI server 的共同底座。

每个函数一进一出，不 print、不碰 runs/ 目录、不持有跨调用状态。
"""

import json

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


def _parse_json_array(text: str) -> list:
    """解析模型输出的 JSON 数组；剥一层 ``` 围栏后重试一次。"""
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
        raise LLMAPIError(f"[score_topics] 模型输出不是合法 JSON：{text[:200]}")


def score_topics(track_id: str, items: list[dict]) -> tuple[list[dict], llm.LLMCall]:
    """选题打分：RSS 条目列表 → [{id, score, angle, reason}]（小模型省钱）。

    items: [{"id": str, "title": str, "summary": str}]，调用方每批 ≤20 条。
    """
    from . import prompts
    t = tracks.get_track(track_id)
    prompt = prompts.TOPIC_SCORE_PROMPTS[track_id].format(
        redline=t["redline"],
        items_json=json.dumps(items, ensure_ascii=False, indent=1),
    )
    # 英文候选（Reddit/HN）标题摘要长、angle/reason 要中文，输出预算给足
    c = llm.call("score_topics", prompt, config.GATE_MODEL, 5000)
    return _parse_json_array(c.response), c
