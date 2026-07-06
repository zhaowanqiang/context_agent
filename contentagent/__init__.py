"""contentagent — @zynqorw 内容生产流水线 CLI。

两跳生成 + 事实闸门：
  Hop 1  出大纲（强模型）→ 人工改完确认
  Hop 2  大纲 + few-shot 出成稿（强模型）
  Gate   拎出硬信息待核实清单 + 红线检查（小模型）
"""

__version__ = "0.2.0"
