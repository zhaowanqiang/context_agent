import "server-only";
import { visibleKeywords } from "@/lib/tutorials";

/**
 * 交流群机器人关键词 —— 首页「交流群」区块的标签云数据。
 *
 * 从 data/tutorials.json 派生：每篇（已上线分类的）教程的 keyword 就是群里的触发词。
 * 此前这里是手写的一份清单，要和机器人配置手动对齐，结果写了机器人不认的词。
 * 现在加一篇教程，标签云自动多一个词。
 *
 * server-only：lib/tutorials.ts 带着整份 JSON（含暂不上线的分类），不能进浏览器 bundle。
 * 首页（服务端）读这里，再把结果当 props 传给 TgGroupSection。
 */
export const TG_KEYWORDS: string[] = visibleKeywords();

/**
 * 群二维码图片路径（放在 public/ 下，如 "/tg-qr.png"）。
 * null = 还没提供，首页交流群区块不渲染二维码栏。
 */
export const TG_QR_IMAGE: string | null = null;
