import type { CryptoCard } from "@/data/crypto-cards";

/**
 * 卡面渲染。仓库里没有任何卡面图片资产，所以统一走渐变 + 文字标识——
 * 刻意不画成仿真的品牌卡面：那既没有素材来源，也容易被当成官方物料。
 *
 * 3D 倾斜、高光、扫光三层都在这里（消费 .cc-* 变量，规则见 globals.css），
 * 但驱动它们的指针数值由 CardTile 写入，本组件是纯展示、无状态。
 */

/**
 * 品牌标识占位：首字母 monogram。
 *
 * 为什么不下载品牌 logo：那是第三方商标资产，仓库里一个都没有，
 * 也不引外部图床/CDN（离线即碎图，且等于把访客 IP 送给第三方）。
 * 底色取卡面主色的反相层（浅底卡用深色块、深底卡用浅色块），
 * 字母用卡面主色，保证两种卡面上都有对比度。
 */
function Monogram({ name, brand, light, compact }: { name: string; brand: string; light: boolean; compact: boolean }) {
  // 取首个拉丁字母；「待确认」这类没有拉丁字母的条目退回 "?"，不猜品牌
  const initial = name.match(/[A-Za-z0-9]/)?.[0].toUpperCase() ?? "?";
  const plate = light ? "#ffffff" : "#1c1917";
  const size = compact ? 14 : 22;

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className="shrink-0"
      style={{ opacity: 0.92 }}
    >
      <rect width="24" height="24" rx="7" fill={plate} />
      <text
        x="12"
        y="12"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="13"
        fontWeight="700"
        fill={brand}
        fontFamily="ui-sans-serif, system-ui, sans-serif"
      >
        {initial}
      </text>
    </svg>
  );
}
export default function CardArt({
  card,
  className = "",
  compact = false,
}: {
  card: CryptoCard;
  className?: string;
  compact?: boolean;
}) {
  const { art } = card;
  const light = art.textColor === "light";
  const background =
    art.type === "image" && art.src
      ? `url(${art.src}) center/cover`
      : `linear-gradient(135deg, ${art.from ?? "#44403c"}, ${art.to ?? "#1c1917"})`;

  return (
    <div
      className={`cc-art relative isolate overflow-hidden rounded-2xl ${className}`}
      style={{ aspectRatio: "1.586", background }}
    >
      {/* 芯片 */}
      <svg
        aria-hidden="true"
        viewBox="0 0 32 24"
        className={`absolute left-[7%] top-[26%] ${compact ? "w-5" : "w-8"} ${light ? "opacity-80" : "opacity-70"}`}
      >
        <rect x="0.5" y="0.5" width="31" height="23" rx="4" fill="#d6c08a" stroke="#b09a63" />
        <path d="M11 .5v23M21 .5v23M.5 8h31M.5 16h31" stroke="#b09a63" strokeWidth="1" fill="none" />
      </svg>

      {/* NFC */}
      <svg
        aria-hidden="true"
        viewBox="0 0 16 20"
        className={`absolute left-[22%] top-[27%] ${compact ? "w-2.5" : "w-4"} ${light ? "opacity-70" : "opacity-60"}`}
      >
        <g fill="none" stroke={light ? "#fff" : "#1c1917"} strokeWidth="1.6" strokeLinecap="round">
          <path d="M2 4a9 9 0 0 1 0 12" />
          <path d="M6 6.5a5.5 5.5 0 0 1 0 7" />
          <path d="M10 9a2 2 0 0 1 0 2" />
        </g>
      </svg>

      {/* 卡名 + 首字母占位标识 */}
      <div className={`absolute left-[7%] top-[9%] flex items-center pr-[7%] ${compact ? "gap-1" : "gap-1.5"}`}>
        <Monogram name={card.name} brand={art.from ?? "#44403c"} light={light} compact={compact} />
        <p
          className={`truncate font-semibold tracking-tight ${
            compact ? "text-[11px]" : "text-sm"
          } ${light ? "text-white/90" : "text-neutral-900/90"}`}
        >
          {card.name}
        </p>
      </div>

      {/* 卡组织 + 等级：都是「卡面上印着什么就写什么」，没读到就不印，避免把猜测印上去 */}
      {card.issuer && card.issuer !== "Other" && (
        <div className="absolute bottom-[8%] right-[7%] text-right">
          <p
            className={`font-semibold italic tracking-tight ${
              compact ? "text-[11px]" : "text-base"
            } ${light ? "text-white/85" : "text-neutral-900/80"}`}
          >
            {card.issuer}
          </p>
          {card.tier && (
            <p
              className={`-mt-0.5 tracking-wide ${compact ? "text-[6px]" : "text-[9px]"} ${
                light ? "text-white/70" : "text-neutral-900/60"
              }`}
            >
              {card.tier}
            </p>
          )}
        </div>
      )}

      {/* 高光与扫光：pointer-events-none，不挡点击 */}
      <div className="cc-glare absolute inset-0 z-10" aria-hidden="true" />
      <div className="cc-shine absolute inset-0 z-10" aria-hidden="true" />
    </div>
  );
}
