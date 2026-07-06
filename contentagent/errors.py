"""异常体系。

CLI 与 FastAPI 共用同一套底层代码，底层不再 raise SystemExit：
- CLI 在 cli.py 外层捕 ContentAgentError 转 SystemExit（保住友好报错）
- server.py 把各异常映射为对应 HTTP 状态码
"""


class ContentAgentError(Exception):
    """所有业务异常的基类。"""


class ConfigError(ContentAgentError):
    """配置问题：缺 API key、缺 style 文件、未知轨道。"""


class LLMAPIError(ContentAgentError):
    """API 返回错误状态码。"""

    def __init__(self, message: str, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code


class LLMTimeoutError(ContentAgentError):
    """API 请求超时。"""


class LLMConnectionError(ContentAgentError):
    """网络连接失败。"""
