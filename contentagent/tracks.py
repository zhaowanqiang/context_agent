"""轨道（track）配置：每条内容线的风格文件路径、fewshot 目录、红线、模板、token 预算。

轨道的「真身」在代码与 tracks/ 目录里，不在数据库 —— 红线必须硬编码，
本文件的 redline 字段只允许引用 prompts.REDLINES 常量，不得改成从文件/DB 读。
"""

from . import config, prompts
from .errors import ConfigError

TRACKS = {
    "x": {
        "id": "x",
        "style_path": config.PROJECT_ROOT / "tracks" / "x" / "style.md",
        "fewshot_dir": config.PROJECT_ROOT / "tracks" / "x" / "fewshot",
        "redline": prompts.REDLINES["x"],
        "prompts": prompts.PROMPTS["x"],
        "max_tokens": {"outline": 2000, "draft": 4000, "gate": 2000},
    },
    "wechat": {
        "id": "wechat",
        "style_path": config.PROJECT_ROOT / "tracks" / "wechat" / "style.md",
        "fewshot_dir": config.PROJECT_ROOT / "tracks" / "wechat" / "fewshot",
        "redline": prompts.REDLINES["wechat"],
        "prompts": prompts.PROMPTS["wechat"],
        # 长文：outline 略放宽，draft 加倍
        "max_tokens": {"outline": 2500, "draft": 8000, "gate": 2000},
    },
}


def get_track(track_id: str) -> dict:
    if track_id not in TRACKS:
        raise ConfigError(f"未知轨道：{track_id}（可用：{', '.join(TRACKS)}）")
    return TRACKS[track_id]
