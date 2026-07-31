import type { CardFace } from "@/data/crypto-cards";

/**
 * 卡面配方 → 实际 CSS 的翻译层。纯函数，客户端与服务端都能调。
 *
 * 放在 lib 而不是组件里的原因：CardFace 组件和 CardTile 的阴影计算都要用
 * 同一份「这张卡的底色是什么」判断，逻辑只能有一份。
 */

/* ───────────────── 颜色工具 ───────────────── */

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** WCAG 相对亮度。用于「深色卡面配浅色字」的自动判断，不靠人肉标 textColor */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** 两色对比度，用于自检脚本核对卡面文字是否达 4.5:1 */
export function contrastRatio(a: string, b: string): number {
  const [l1, l2] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/* ───────────────── 配方 → CSS ───────────────── */

/** 配方的「代表色」：算亮度、算阴影辉光都用它 */
export function baseColorOf(face: CardFace): string {
  switch (face.kind) {
    case "solid":
      return face.color;
    case "linear":
    case "radial":
      return face.from;
    case "mesh":
      return face.stops[0]?.color ?? "#44403c";
    case "metallic":
      return face.base;
    case "wordmark":
    case "pattern":
      return face.bg;
  }
}

/** 亮底用深字、深底用浅字。阈值 0.5 是 spec 定的，不另立标准 */
export function isLightFace(face: CardFace): boolean {
  return relativeLuminance(baseColorOf(face)) > 0.5;
}

/** 卡面上文字/图标的墨色。不用纯黑纯白——纯黑在彩底上发脏，纯白在浅底上不可读 */
export function inkOf(face: CardFace): string {
  return isLightFace(face) ? "#1c1917" : "#ffffff";
}

/**
 * L0 底色层的 background 值。
 * metallic 是多条窄角度色标叠出来的拉丝感，不是简单两色渐变。
 */
export function backgroundOf(face: CardFace): string {
  switch (face.kind) {
    case "solid":
      return face.color;

    case "linear":
      return `linear-gradient(${face.angle}deg, ${face.from}, ${face.to})`;

    case "radial":
      return `radial-gradient(120% 120% at ${face.at[0]}% ${face.at[1]}%, ${face.from}, ${face.to})`;

    case "mesh":
      // 多个 radial 叠加 = 网格渐变。最后补一层底色兜住没被覆盖的角落
      return (
        face.stops
          .map((s, i) => {
            const size = 70 + (i % 3) * 15;
            return `radial-gradient(${size}% ${size}% at ${s.at[0]}% ${s.at[1]}%, ${s.color}, transparent 70%)`;
          })
          .join(", ") + `, ${face.stops[face.stops.length - 1]?.color ?? "#44403c"}`
      );

    case "metallic": {
      // 拉丝：明暗窄带交替。alpha 压得很低，否则像塑料不像金属
      const a = face.sheenAngle;
      return [
        `linear-gradient(${a}deg,` +
          ` rgba(255,255,255,0) 0%, rgba(255,255,255,.42) 18%, rgba(255,255,255,0) 32%,` +
          ` rgba(0,0,0,.16) 46%, rgba(255,255,255,.30) 62%, rgba(255,255,255,0) 74%,` +
          ` rgba(0,0,0,.12) 88%, rgba(255,255,255,.20) 100%)`,
        face.base,
      ].join(", ");
    }

    case "wordmark":
      return face.bg;

    case "pattern":
      return face.bg;
  }
}

/**
 * hover 时叠在黑色投影之上的品牌色辉光。
 * 深色卡面上纯黑投影几乎看不见，用底色辉光才有「浮起来」的感觉；
 * 浅色卡面加辉光会发脏，返回 transparent 让这一层失效。
 *
 * 只返回颜色、不返回整条 box-shadow：偏移量要跟着倾斜角走，
 * 那部分由 CSS 用 calc(var(--cc-sx) * 1px) 算，两边各管各的。
 */
export function glowOf(face: CardFace): string {
  return isLightFace(face) ? "transparent" : rgba(baseColorOf(face), 0.25);
}
