"""runs/ 下的运行记录：一次运行一个目录，run.json 存全量数据供以后做 eval。"""

import json
from datetime import datetime
from pathlib import Path
from uuid import uuid4

from . import config


def create_run_dir() -> tuple[str, Path]:
    # 秒级时间戳 + 短随机后缀：避免同一秒两次运行撞目录
    run_id = datetime.now().strftime("%Y%m%d-%H%M%S") + "-" + uuid4().hex[:4]
    run_dir = config.RUNS_DIR / run_id
    run_dir.mkdir(parents=True, exist_ok=True)
    return run_id, run_dir


def save_record(run_dir: Path, record: dict) -> Path:
    path = run_dir / "run.json"
    path.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")
    return path
