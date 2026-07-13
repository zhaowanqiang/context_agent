import { ImageResponse } from "next/og";
import { ogFonts } from "@/lib/ogFont";
import { SITE } from "@/lib/site";

/* 站点级 OG 分享图（首页/文章以外的页面兜底）：暖底 + 琥珀点 + 站点定位 */

export const alt = SITE.name;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// 请求时渲染：构建机在国内拉不动 Google Fonts（构建期预渲染曾直接炸），
// Vercel 请求时渲染 + 平台缓存没这个问题
export const dynamic = "force-dynamic";

export default async function Image() {
  const { fonts, hasCjk } = await ogFonts("跨境金融与 AI 工具实测");
  // CJK 子集拉取失败时退回纯拉丁文案——无 CJK 字形时中文会渲染成豆腐块
  const tagline = hasCjk ? "跨境金融与 AI 工具实测" : "Cross-border Finance & AI Tools, Field-tested";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: "#fafaf9",
          fontFamily: "Noto Sans SC",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", fontSize: 96, fontWeight: 700, color: "#1c1917" }}>
          {SITE.name}
          <span style={{ color: "#f59e0b" }}>.</span>
        </div>
        <div style={{ marginTop: 28, fontSize: 40, color: "#57534e" }}>{tagline}</div>
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
