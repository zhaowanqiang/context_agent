import type { CryptoCard } from "@/data/crypto-cards";
import { backgroundOf, inkOf, isLightFace } from "@/lib/cardFace";
import { NOISE_DATA_URI } from "./FacePatterns";

/**
 * 卡面渲染。五层结构，从下到上：
 *   L0 底色   faceStyle 按 kind 分派（lib/cardFace.ts 负责翻译成 CSS）
 *   L1 图案   内联 SVG pattern（几何在 FacePatterns.tsx 里只定义一次）/ 大字 wordmark
 *   L2 噪点   feTurbulence 生成的 data-URI 平铺，消除渐变色带
 *   L3 内容   品牌标识、芯片、闪付、掩码位、等级、卡组织
 *   L4 高光   跟随指针的镜面反射，默认全透明
 *
 * 本组件纯展示、无状态。3D 与高光靠 CardTile 写入的 CSS 变量驱动，
 * 规则在 globals.css，整条链路不触发 React 重渲染。
 *
 * 几何按 ISO/IEC 7810 ID-1 真实卡片比例：85.6 × 53.98mm。
 * 圆角写成 `3.7% / 5.868%`——CSS 的百分比圆角横向按宽、纵向按高解析，
 * 直接写 3.7% 会得到椭圆角；除以 1.586 补偿后才是「宽度 × 3.7%」的正圆角。
 */

/** 卡面上不放真实卡号——仓库里没有，也不该有。只留卡片版式的形状感 */
function MaskedDigits({ compact }: { compact: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex items-center ${compact ? "gap-1 text-[6px]" : "gap-1.5 text-[10px]"}`}
      style={{ letterSpacing: "0.18em", opacity: 0.62 }}
    >
      <span>••••</span>
      <span>••••</span>
      <span>••••</span>
      <span>••••</span>
    </span>
  );
}

/**
 * 品牌标识占位。
 *
 * 没有官方 logo（原因见 docs/card-faces-research.md），用首字母 monogram 顶上，
 * 但**不给所有卡套同一个字母徽章**——按配方分三种处理，让卡面之间自己拉开差距：
 *   metallic → 细描边方框，配合拉丝底
 *   wordmark → 不出徽章，卡面背后那个大字本身就是主视觉
 *   其余     → 品牌色圆角方块
 */
function BrandMark({ card, compact }: { card: CryptoCard; compact: boolean }) {
  const face = card.faceStyle;
  const ink = inkOf(face);
  const initial = card.name.match(/[A-Za-z0-9]/)?.[0].toUpperCase() ?? "?";
  const size = compact ? 13 : 20;

  if (face.kind === "wordmark") return null;

  if (face.kind === "metallic") {
    return (
      <span
        aria-hidden="true"
        className="grid shrink-0 place-items-center rounded-[5px] font-semibold"
        style={{
          width: size,
          height: size,
          border: `1px solid ${ink}`,
          color: ink,
          fontSize: size * 0.58,
          opacity: 0.9,
        }}
      >
        {initial}
      </span>
    );
  }

  const plate = isLightFace(face) ? "#1c1917" : "#ffffff";
  const letter = isLightFace(face) ? "#ffffff" : "#1c1917";
  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 place-items-center rounded-[5px] font-semibold"
      style={{ width: size, height: size, background: plate, color: letter, fontSize: size * 0.6 }}
    >
      {initial}
    </span>
  );
}

export default function CardFace({
  card,
  className = "",
  compact = false,
}: {
  card: CryptoCard;
  className?: string;
  compact?: boolean;
}) {
  const face = card.faceStyle;
  const ink = inkOf(face);
  const initial = card.name.match(/[A-Za-z0-9]/)?.[0].toUpperCase() ?? "?";

  return (
    <div
      className={`cc-face relative isolate overflow-hidden ${className}`}
      style={{
        aspectRatio: "1.586",
        borderRadius: "3.7% / 5.868%",
        background: backgroundOf(face),
        color: ink,
      }}
    >
      {/* ── L1 图案层 ───────────────────────────────── */}
      {face.kind === "pattern" && (
        <svg
          aria-hidden="true"
          className="cc-face-l1 absolute inset-0 h-full w-full"
          style={{ opacity: face.opacity, mixBlendMode: face.blend as React.CSSProperties["mixBlendMode"] }}
        >
          <rect width="100%" height="100%" fill={`url(#cc-pat-${face.pattern})`} />
        </svg>
      )}

      {/* 大字 wordmark 走 SVG viewBox 而不是 cqw 容器查询单位：
          container-type 会带来 layout containment，preserve-3d 会被压平，视差层就没了。
          viewBox 缩放同样能跟着卡宽走，且不产生任何 containment 副作用。 */}
      {face.kind === "wordmark" && (
        <svg
          aria-hidden="true"
          viewBox="0 0 158.6 100"
          className="cc-face-l1 pointer-events-none absolute inset-0 h-full w-full"
        >
          <text
            x="166"
            y="114"
            textAnchor="end"
            fill={face.markColor}
            fontSize={84 * face.scale}
            fontWeight="800"
            letterSpacing="-4"
          >
            {initial}
          </text>
        </svg>
      )}

      {/* ── L2 噪点层：压掉渐变色带。用平铺背景而不是 CSS filter——
             filter 会让 43 张卡每帧重算滤镜，背景图只解码一次 ───── */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{ backgroundImage: NOISE_DATA_URI, backgroundRepeat: "repeat", opacity: 0.05 }}
      />

      {/* ── L3 内容层 ───────────────────────────────── */}
      <div className="absolute inset-0 z-[2]">
        {/* 左上：品牌标识 + 卡名 */}
        <div
          className={`cc-face-l3 absolute flex items-center ${compact ? "gap-1" : "gap-1.5"}`}
          style={{ left: "7%", top: "8%", right: "7%" }}
        >
          <BrandMark card={card} compact={compact} />
          <p
            className={`truncate font-semibold tracking-tight ${compact ? "text-[10px]" : "text-[13px]"}`}
            style={{ color: ink, opacity: 0.95 }}
          >
            {card.name}
          </p>
        </div>

        {/* 芯片 + 闪付：真实卡片版式里两者相邻，位于卡面左侧偏上 */}
        <div className="absolute flex items-center" style={{ left: "7%", top: "38%", gap: compact ? 4 : 7 }}>
          <svg aria-hidden="true" viewBox="0 0 32 24" className={compact ? "w-[18px]" : "w-[30px]"} style={{ opacity: 0.85 }}>
            <rect x="0.5" y="0.5" width="31" height="23" rx="4" fill="#d6c08a" stroke="#b09a63" />
            <path d="M11 .5v23M21 .5v23M.5 8h31M.5 16h31" stroke="#b09a63" strokeWidth="1" fill="none" />
          </svg>
          <svg aria-hidden="true" viewBox="0 0 16 20" className={compact ? "w-[8px]" : "w-[13px]"} style={{ opacity: 0.7 }}>
            <g fill="none" stroke={ink} strokeWidth="1.6" strokeLinecap="round">
              <path d="M2 4a9 9 0 0 1 0 12" />
              <path d="M6 6.5a5.5 5.5 0 0 1 0 7" />
              <path d="M10 9a2 2 0 0 1 0 2" />
            </g>
          </svg>
        </div>

        {/* 掩码位：真实卡片在芯片下方 */}
        <div className="absolute" style={{ left: "7%", bottom: "22%", color: ink }}>
          <MaskedDigits compact={compact} />
        </div>

        {/* 右下：卡组织 + 等级。卡面上印着什么就写什么，没读到就不印 */}
        {card.issuer && card.issuer !== "Other" && (
          <div className="absolute text-right" style={{ right: "7%", bottom: "8%", color: ink }}>
            <p
              className={`font-semibold italic tracking-tight ${compact ? "text-[10px]" : "text-[15px]"}`}
              style={{ opacity: 0.92 }}
            >
              {card.issuer}
            </p>
            {card.tier && (
              <p className={`-mt-0.5 tracking-wide ${compact ? "text-[6px]" : "text-[8.5px]"}`} style={{ opacity: 0.78 }}>
                {card.tier}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── L4 高光层：pointer-events-none，不挡点击 ───── */}
      <div className="cc-glare absolute inset-0 z-[3]" aria-hidden="true" />
      {face.kind === "metallic" && <div className="cc-sheen absolute inset-0 z-[3]" aria-hidden="true" />}
      <div className="cc-shine absolute inset-0 z-[3]" aria-hidden="true" />
    </div>
  );
}
