/**
 * 交流群机器人关键词 —— 首页「交流群」区块的标签云数据。
 *
 * 成员在群里发这些词，@zynqorw_bot 回复对应教程链接。
 * 这里只是展示用的清单，**机器人的实际关键词配置不在本站**，
 * 两边要手动保持一致：机器人不认的词写在这里，访客发了会没反应。
 */
export const TG_KEYWORDS: string[] = [
  // TODO(@zynqorw)：补全机器人实际支持的关键词
  "maya",
  "wise",
  "vps",
  "交易所",
  "U卡",
];

/**
 * 群二维码图片路径（放在 public/ 下，如 "/tg-qr.png"）。
 * null = 还没提供，页面显示 PLACEHOLDER 占位框。
 */
export const TG_QR_IMAGE: string | null = null; // PLACEHOLDER：群二维码待提供
