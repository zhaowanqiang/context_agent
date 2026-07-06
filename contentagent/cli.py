"""CLI 入口：python -m contentagent run --material path/to/notes.txt（或直接粘贴）。"""

import argparse
import sys
from pathlib import Path

from .errors import ContentAgentError
from .pipeline import run_pipeline


def _read_material_interactive() -> str:
    print("粘贴原始素材（实测笔记，越具体越好）。")
    print("粘贴完后另起一行输入 EOF 再回车结束：\n")
    lines = []
    for line in sys.stdin:
        if line.strip() == "EOF":
            break
        lines.append(line)
    return "".join(lines)


def main(argv: list[str] | None = None) -> None:
    # Windows 控制台默认 GBK，中文输出会乱码，统一成 UTF-8
    if sys.stdout.encoding and sys.stdout.encoding.lower().replace("-", "") != "utf8":
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")

    parser = argparse.ArgumentParser(
        prog="contentagent",
        description="把实测原始笔记生成为个人风格的干货教程帖（两跳生成 + 事实闸门，human-in-the-loop）。",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p_run = sub.add_parser("run", help="跑一次完整 pipeline")
    p_run.add_argument("--material", type=Path, metavar="FILE",
                       help="原始素材文件路径；不传则进入交互粘贴模式")
    p_run.add_argument("--track", choices=["x", "wechat"], default="x",
                       help="内容轨道：x（默认，X 干货帖）/ wechat（公众号长文）")
    p_run.add_argument("-v", "--verbose", action="store_true",
                       help="打印每次 LLM 调用的完整 input（output 默认就打印）")

    args = parser.parse_args(argv)

    if args.command == "run":
        if args.material:
            if not args.material.exists():
                raise SystemExit(f"素材文件不存在：{args.material}")
            material = args.material.read_text(encoding="utf-8")
        else:
            material = _read_material_interactive()

        if not material.strip():
            raise SystemExit("素材为空，退出。")

        try:
            run_pipeline(material, verbose=args.verbose, track_id=args.track)
        except ContentAgentError as e:
            raise SystemExit(str(e))
