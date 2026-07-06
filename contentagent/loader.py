"""加载轨道的 style.md 与 fewshot/*.md。"""

import logging

from .errors import ConfigError

_log = logging.getLogger(__name__)


def load_style(track: dict) -> str:
    path = track["style_path"]
    if not path.exists():
        raise ConfigError(f"找不到风格文件：{path}\n风格指纹必须从文件加载，请先准备 style.md。")
    return path.read_text(encoding="utf-8")


def load_fewshot(track: dict) -> str:
    """按文件名排序拼接 fewshot/*.md。增删文件即增删范例，无需改代码。"""
    fewshot_dir = track["fewshot_dir"]
    files = sorted(fewshot_dir.glob("*.md")) if fewshot_dir.exists() else []
    if not files:
        _log.warning("%s 下没有 few-shot 范例，成稿风格会打折扣。", fewshot_dir)
        return "（暂无范例）"
    parts = []
    for i, f in enumerate(files, 1):
        parts.append(f"【范例 {i} · {f.stem}】\n{f.read_text(encoding='utf-8').strip()}")
    return "\n\n".join(parts)
