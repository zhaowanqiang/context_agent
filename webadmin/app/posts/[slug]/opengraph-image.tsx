import { ImageResponse } from "next/og";
import { ogFonts } from "@/lib/ogFont";
import { getPostBySlug } from "@/lib/posts";
import { SITE } from "@/lib/site";
import { TRACK_LABEL } from "@/lib/types";

/* 每篇文章的 OG 分享图：X/微信转发时的大图卡片——标题即海报 */

export const alt = "文章分享图";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug).catch(() => null);
  const { fonts, hasCjk } = await ogFonts((post?.title ?? "") + "干货帖公众号长文实测本人起草核对");
  // CJK 子集拉取失败时全部文案退回拉丁字符（豆腐块比缺图更难看）
  const title = hasCjk ? post?.title ?? SITE.name : SITE.name;
  const eyebrow = hasCjk
    ? `${post?.track ? TRACK_LABEL[post.track] : "实测"} · 本人实测`
    : "Field-tested notes";
  const footRight = hasCjk ? "AI 起草 · 人工核对" : "AI-drafted · human-verified";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#fafaf9",
          padding: "64px 72px",
          fontFamily: "Noto Sans SC",
        }}
      >
        {/* 眉题 */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 14, height: 14, borderRadius: 999, background: "#f59e0b", display: "flex" }} />
          <div style={{ fontSize: 30, color: "#78716c" }}>{eyebrow}</div>
        </div>

        {/* 标题（长标题自动换行，最多约三行） */}
        <div
          style={{
            fontSize: title.length > 28 ? 56 : 66,
            fontWeight: 700,
            color: "#1c1917",
            lineHeight: 1.35,
            letterSpacing: "-0.02em",
            display: "flex",
          }}
        >
          {title.slice(0, 60)}
        </div>

        {/* 页脚品牌行 */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "baseline", fontSize: 40, fontWeight: 700, color: "#1c1917" }}>
            {SITE.name}
            <span style={{ color: "#f59e0b" }}>.</span>
            <span style={{ marginLeft: 18, fontSize: 26, fontWeight: 400, color: "#a8a29e" }}>zynqorw.com</span>
          </div>
          <div style={{ fontSize: 26, color: "#a8a29e" }}>{footRight}</div>
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            width: "100%",
            height: 14,
            background: "#d97706",
            display: "flex",
          }}
        />
      </div>
    ),
    { ...size, fonts }
  );
}
