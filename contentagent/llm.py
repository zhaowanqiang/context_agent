"""Anthropic API 统一出口。

所有 LLM 调用走 call()：超时、失败重试一次（SDK 指数退避）、
返回文本 + token 用量，input/output 全量进 run 记录，方便回放调 prompt。
本模块不 print、不 SystemExit —— CLI 与 FastAPI 共用，报错走 errors.py 异常。
"""

import os
from dataclasses import dataclass, field

import anthropic

from . import config
from .errors import ConfigError, LLMAPIError, LLMConnectionError, LLMTimeoutError

_client = None


def ensure_client() -> None:
    """在 pipeline 开始前预检 API key，避免跑到一半才报错。"""
    _get_client()


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        api_key = os.environ.get(config.API_KEY_ENV)
        if not api_key:
            raise ConfigError(
                f"未检测到 {config.API_KEY_ENV} 环境变量（当前供应商：{config.PROVIDER}）。\n"
                f"PowerShell 里执行：  $env:{config.API_KEY_ENV} = \"你的key\"\n"
                f"（持久化用：setx {config.API_KEY_ENV} \"你的key\"，然后重开终端）"
            )
        _client = anthropic.Anthropic(
            api_key=api_key,
            base_url=config.API_BASE_URL,  # None 时走 SDK 默认（Anthropic 官方）
            max_retries=config.MAX_RETRIES,
            timeout=config.REQUEST_TIMEOUT,
        )
    return _client


@dataclass
class LLMCall:
    """一次 LLM 调用的完整记录，原样进 run.json / llm_calls 表。"""
    step: str
    model: str
    prompt: str
    response: str = ""
    usage: dict = field(default_factory=dict)


def call(step: str, prompt: str, model: str, max_tokens: int,
         thinking: bool = False) -> LLMCall:
    client = _get_client()

    kwargs = dict(
        model=model,
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": prompt}],
    )
    if thinking and config.THINKING:
        kwargs["thinking"] = config.THINKING

    try:
        msg = client.messages.create(**kwargs)
    except anthropic.APIStatusError as e:
        raise LLMAPIError(
            f"[{step}] API 调用失败（已重试 {config.MAX_RETRIES} 次）：HTTP {e.status_code} {e.message}",
            status_code=e.status_code,
        )
    except anthropic.APITimeoutError:
        raise LLMTimeoutError(
            f"[{step}] API 请求超时（{config.REQUEST_TIMEOUT:.0f}s，已重试 {config.MAX_RETRIES} 次）。")
    except anthropic.APIConnectionError as e:
        raise LLMConnectionError(f"[{step}] 网络连接失败：{e}")

    text = "".join(b.text for b in msg.content if b.type == "text")
    if not text.strip():
        # 推理模型思考链耗尽 max_tokens 时正文为空——静默放行会产出空 checklist/空稿
        raise LLMAPIError(
            f"[{step}] 模型输出正文为空（output_tokens={msg.usage.output_tokens}，"
            f"可能是思考链耗尽 max_tokens={max_tokens}，调大该步骤预算后重试）"
        )
    usage = {
        "input_tokens": msg.usage.input_tokens,
        "output_tokens": msg.usage.output_tokens,
    }
    return LLMCall(step=step, model=model, prompt=prompt, response=text, usage=usage)
