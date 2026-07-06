"""CLI 模式的核心 pipeline：Hop 1 → 人工确认 → Hop 2 → Gate → 落记录。

LLM 三段的实现在 steps.py（与 FastAPI server 共用）；
本文件只负责编排、人工闸口（input()）与 runs/ 目录落盘。
"""

from dataclasses import asdict
from datetime import datetime

from . import config, llm, recorder, steps, tracks


def _pause_for_edit(outline_path) -> str | None:
    """打印提示并暂停。返回人工改后的大纲；输入 q 返回 None（放弃）。"""
    print(f"\n★ 大纲已写入：{outline_path}")
    print("  直接在编辑器里改这个文件（选题角度 / 步骤顺序 / 坑够不够）。")
    try:
        ans = input("  改完（或不改）按回车继续生成成稿；输入 q 回车放弃本次运行 > ")
    except EOFError:
        ans = ""  # 非交互（管道）场景：视为直接确认
    if ans.strip().lower() == "q":
        return None
    return outline_path.read_text(encoding="utf-8")


def _print_verbose_input(c: llm.LLMCall) -> None:
    print(f"\n---------- [{c.step}] INPUT ({c.model}) ----------")
    print(c.prompt)
    print(f"---------- [{c.step}] INPUT 结束 ----------\n")


def run_pipeline(material: str, verbose: bool = False, track_id: str = "x") -> None:
    llm.ensure_client()      # 先预检 API key，再创建运行目录
    tracks.get_track(track_id)  # 预检轨道与配置

    run_id, run_dir = recorder.create_run_dir()
    print(f"运行 ID：{run_id}（记录目录：{run_dir}）")

    calls: list[llm.LLMCall] = []
    record = {
        "run_id": run_id,
        "timestamp": datetime.now().astimezone().isoformat(),
        "track": track_id,
        "models": {"strong": config.STRONG_MODEL, "gate": config.GATE_MODEL},
        "status": "started",
        "material": material,
    }

    def _finish(status: str) -> None:
        record["status"] = status
        record["calls"] = [asdict(c) for c in calls]
        record["token_usage"] = {
            "input_tokens": sum(c.usage.get("input_tokens", 0) for c in calls),
            "output_tokens": sum(c.usage.get("output_tokens", 0) for c in calls),
        }
        path = recorder.save_record(run_dir, record)
        print(f"\n运行记录已保存：{path}")

    # ── Hop 1：大纲 ──────────────────────────────────────────────
    print(f"\n========== Hop 1：大纲（{config.STRONG_MODEL}）==========\n")
    c1 = steps.generate_outline(track_id, material)
    calls.append(c1)
    if verbose:
        _print_verbose_input(c1)
    print(c1.response)
    record["outline_generated"] = c1.response

    outline_path = run_dir / "outline.md"
    outline_path.write_text(c1.response, encoding="utf-8")

    # ── 人工闸口：改大纲，改完确认 ────────────────────────────────
    outline_final = _pause_for_edit(outline_path)
    if outline_final is None:
        print("已放弃，本次运行到大纲为止。")
        _finish("aborted_after_outline")
        return
    record["outline_final"] = outline_final
    record["outline_edited"] = outline_final.strip() != c1.response.strip()

    # ── Hop 2：成稿 ──────────────────────────────────────────────
    print(f"\n========== Hop 2：成稿（{config.STRONG_MODEL}）==========\n")
    c2 = steps.generate_draft(track_id, outline_final)
    calls.append(c2)
    if verbose:
        _print_verbose_input(c2)
    print(c2.response)
    record["draft"] = c2.response
    (run_dir / "draft.md").write_text(c2.response, encoding="utf-8")

    # ── Gate：红线检查 + 待核实清单（小模型省钱）──────────────────
    print(f"\n========== Gate：待核实清单（{config.GATE_MODEL}）==========\n")
    c3 = steps.run_gate(track_id, c2.response, material)
    calls.append(c3)
    if verbose:
        _print_verbose_input(c3)
    print(c3.response)
    record["checklist"] = c3.response
    (run_dir / "checklist.md").write_text(c3.response, encoding="utf-8")

    _finish("completed")
    print("发布前：逐条核对 checklist.md，确认无误后再发。")
