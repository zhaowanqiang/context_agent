"""路径与模型配置。改模型/供应商/预算只动这里。"""

import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent


def _load_dotenv() -> None:
    """读取项目根目录 .env（KEY=VALUE 每行一条）。已有的环境变量优先，不覆盖。"""
    env_file = PROJECT_ROOT / ".env"
    if not env_file.exists():
        return
    # utf-8-sig：兼容 Windows 编辑器保存时带的 BOM
    for line in env_file.read_text(encoding="utf-8-sig").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_dotenv()

# style / fewshot 路径按轨道组织，见 tracks.py（tracks/<id>/style.md 等）
RUNS_DIR = PROJECT_ROOT / "runs"           # CLI 模式每次运行一个目录，含 run.json

# ── 供应商：DeepSeek 兼容 Anthropic API 格式，SDK 不用换 ─────────────
# 切回 Claude 官方：把 PROVIDER 改成 "anthropic" 即可
PROVIDER = "deepseek"

PROVIDERS = {
    "deepseek": {
        "base_url": "https://api.deepseek.com/anthropic",
        "api_key_env": "DEEPSEEK_API_KEY",
        # 成本分级：结构 + 成稿用 pro，事实闸门用 flash
        "strong_model": "deepseek-v4-pro",
        "gate_model": "deepseek-v4-flash",
        # DeepSeek 走 enabled 开启思考（budget_tokens 会被其服务端忽略）
        "thinking": {"type": "enabled", "budget_tokens": 1024},
    },
    "anthropic": {
        "base_url": None,  # SDK 默认官方地址
        "api_key_env": "ANTHROPIC_API_KEY",
        "strong_model": "claude-opus-4-8",
        "gate_model": "claude-haiku-4-5",
        "thinking": {"type": "adaptive"},
    },
}

_p = PROVIDERS[PROVIDER]
API_BASE_URL = _p["base_url"]
API_KEY_ENV = _p["api_key_env"]
STRONG_MODEL = _p["strong_model"]
GATE_MODEL = _p["gate_model"]
THINKING = _p["thinking"]

MAX_TOKENS_OUTLINE = 2000
MAX_TOKENS_DRAFT = 4000
# gate 用的 flash 是推理模型，思考链也计入 output 预算——2000 曾被烧光导致正文为空
MAX_TOKENS_GATE = 4000

REQUEST_TIMEOUT = 300.0  # 单次请求超时（秒）
MAX_RETRIES = 1          # API 失败重试一次（SDK 自带指数退避）
