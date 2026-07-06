/**
 * Publisher 接口：发布通道抽象。
 * 现在只有剪贴板通道（公众号个人订阅号没有发布 API，人工粘贴）；
 * 将来升级认证号后新增 'wechat_api' 实现（草稿 /cgi-bin/draft/add + freepublish/submit），
 * 或给 X 轨道接 'x_api' —— 工作台按 channel 分发，UI 不用改结构。
 */
import type { Run } from "@/lib/types";

export interface PublishOutcome {
  ok: boolean;
  externalId?: string;
  notes?: string;
}

export interface Publisher {
  channel: string; // 'wechat_clipboard' | 'x_manual' | 'wechat_api'(留位) | 'x_api'(留位)
  /** markdown → 该通道的最终格式 */
  render(markdown: string): Promise<{ html: string }>;
  /** 执行发布动作。剪贴板通道里实际粘贴动作在人手上，这里只负责记录。 */
  publish(run: Run): Promise<PublishOutcome>;
}
