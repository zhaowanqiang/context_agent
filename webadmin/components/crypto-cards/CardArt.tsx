import type { CryptoCard } from "@/data/crypto-cards";

/**
 * 卡面渲染。仓库里没有任何卡面图片资产，所以统一走渐变 + 文字标识——
 * 刻意不画成仿真的品牌卡面：那既没有素材来源，也容易被当成官方物料。
 *
 * 3D 倾斜、高光、扫光三层都在这里（消费 .cc-* 变量，规则见 globals.css），
 * 但驱动它们的指针数值由 CardTile 写入，本组件是纯展示、无状态。
 */
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

      {/* 卡名 */}
      <p
        className={`absolute left-[7%] top-[10%] pr-[7%] font-semibold tracking-tight ${
          compact ? "text-[11px]" : "text-sm"
        } ${light ? "text-white/90" : "text-neutral-900/90"}`}
      >
        {card.name}
      </p>

      {/* 卡组织：未核实就不写，避免把猜测印在卡面上 */}
      {card.issuer && card.issuer !== "Other" && (
        <p
          className={`absolute bottom-[9%] right-[7%] font-semibold italic tracking-tight ${
            compact ? "text-[11px]" : "text-base"
          } ${light ? "text-white/85" : "text-neutral-900/80"}`}
        >
          {card.issuer}
        </p>
      )}

      {/* 高光与扫光：pointer-events-none，不挡点击 */}
      <div className="cc-glare absolute inset-0 z-10" aria-hidden="true" />
      <div className="cc-shine absolute inset-0 z-10" aria-hidden="true" />
    </div>
  );
}
