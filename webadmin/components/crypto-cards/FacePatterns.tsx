/**
 * 卡面图案的几何定义。**整页只渲染一次**，43 张卡通过 fill="url(#cc-pat-xxx)" 复用。
 *
 * 为什么不让每张卡各带一份 <defs>：43 张 × 7 种图案 = 上百个重复的 pattern 节点，
 * DOM 和样式计算都是白付的。这里定义一次，各卡只挂一个 <rect>。
 *
 * 描边一律用 currentColor：同一份 def 在深色卡面上是浅描边、浅色卡面上是深描边，
 * 由引用它的 <svg> 的 color 决定（CardFace 按底色亮度设置）。
 * 这样 7 个 def 覆盖全部 43 张卡，不需要为每种配色各生成一份。
 */
export default function FacePatterns() {
  return (
    <svg aria-hidden="true" focusable="false" className="pointer-events-none absolute h-0 w-0 overflow-hidden">
      <defs>
        {/* 方块网格：OKX / Solflare 那类硬边科技感 */}
        <pattern id="cc-pat-grid" width="16" height="16" patternUnits="userSpaceOnUse">
          <path d="M16 0H0v16" fill="none" stroke="currentColor" strokeWidth="1" />
        </pattern>

        {/* 点阵 */}
        <pattern id="cc-pat-dots" width="14" height="14" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="3" r="1.4" fill="currentColor" />
        </pattern>

        {/* 放射线：从左下角发散，模拟卡面上的扇形线条 */}
        <pattern id="cc-pat-rays" width="240" height="150" patternUnits="userSpaceOnUse">
          <g fill="none" stroke="currentColor" strokeWidth="1">
            {Array.from({ length: 14 }, (_, i) => (
              <path key={i} d={`M0 150 Q ${60 + i * 14} ${120 - i * 8} ${240} ${140 - i * 10}`} />
            ))}
          </g>
        </pattern>

        {/* 流线：Jupiter 那类柔和弧线 */}
        <pattern id="cc-pat-waves" width="120" height="60" patternUnits="userSpaceOnUse">
          <g fill="none" stroke="currentColor" strokeWidth="1.2">
            <path d="M0 44 Q 30 20 60 44 T 120 44" />
            <path d="M0 22 Q 30 -2 60 22 T 120 22" />
          </g>
        </pattern>

        {/* 像素消散：Startale 那类从实到虚的方块 */}
        <pattern id="cc-pat-pixels" width="24" height="24" patternUnits="userSpaceOnUse">
          <g fill="currentColor">
            <rect x="0" y="0" width="5" height="5" opacity="0.9" />
            <rect x="9" y="4" width="5" height="5" opacity="0.55" />
            <rect x="18" y="1" width="5" height="5" opacity="0.3" />
            <rect x="4" y="13" width="5" height="5" opacity="0.45" />
            <rect x="15" y="16" width="5" height="5" opacity="0.7" />
          </g>
        </pattern>

        {/* 等高线 */}
        <pattern id="cc-pat-topo" width="90" height="90" patternUnits="userSpaceOnUse">
          <g fill="none" stroke="currentColor" strokeWidth="1">
            <ellipse cx="45" cy="45" rx="40" ry="26" />
            <ellipse cx="45" cy="45" rx="28" ry="17" />
            <ellipse cx="45" cy="45" rx="16" ry="9" />
          </g>
        </pattern>

        {/* 电路纹 */}
        <pattern id="cc-pat-circuit" width="40" height="40" patternUnits="userSpaceOnUse">
          <g fill="none" stroke="currentColor" strokeWidth="1">
            <path d="M4 4h14v12h12M4 26h10v10h22M26 4v10" />
          </g>
          <g fill="currentColor">
            <circle cx="30" cy="16" r="1.8" />
            <circle cx="14" cy="26" r="1.8" />
          </g>
        </pattern>

        {/*
          L2 噪点。用 feTurbulence 生成，但**不作为 CSS filter 挂在 43 个元素上**——
          那是每帧重算的滤镜，43 张卡会直接拖垮合成。这里只生成一次，
          由 CardFace 以 data-URI 背景的形式平铺（浏览器只解码一次，跨元素复用）。
          这个 filter 留给需要局部噪点的场景。
        */}
        <filter id="cc-noise" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
      </defs>
    </svg>
  );
}

/** 与上面 <filter id="cc-noise"> 同参数的独立 SVG，用作 CSS background-image。
 *  内联 data-URI，不产生网络请求，也不是位图资源。 */
export const NOISE_DATA_URI =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)'/%3E%3C/svg%3E\")";
