import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

/** 仓库内置的拉丁子集保底字体（OFL 许可，7.9KB）：Satori 无任何字体会直接崩
 *  （本机连默认字体都加载失败），这个文件保证 OG 图永远至少能出拉丁字。 */
let baseFontCache: ArrayBuffer | null | undefined;
export async function loadBaseFont(): Promise<ArrayBuffer | null> {
  if (baseFontCache !== undefined) return baseFontCache;
  try {
    const buf = await readFile(path.join(process.cwd(), "assets", "og", "base-latin.ttf"));
    baseFontCache = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  } catch {
    baseFontCache = null;
  }
  return baseFontCache;
}

/** 组装 Satori fonts 数组：CJK 子集在前（有则优先取形），保底拉丁在后 */
export async function ogFonts(text: string): Promise<{
  fonts: { name: string; data: ArrayBuffer; weight: 700; style: "normal" }[];
  hasCjk: boolean;
}> {
  const [cjk, base] = await Promise.all([loadCjkFont(text), loadBaseFont()]);
  const fonts = [cjk, base]
    .filter((f): f is ArrayBuffer => f !== null)
    .map((data) => ({ name: "Noto Sans SC", data, weight: 700 as const, style: "normal" as const }));
  return { fonts, hasCjk: cjk !== null };
}

/**
 * OG 图中文字体：Satori 不带 CJK 字形，整包 Noto Sans SC 有 10MB+ 塞不进函数。
 * 用 Google Fonts css2 的 text= 参数做「按需子集」——只取当前标题用到的字符，
 * 通常几十 KB。老 UA 换取 ttf（Satori 不认 woff2）。失败返回 null，调用方降级无字体渲染。
 */
export async function loadCjkFont(text: string, weight = 700): Promise<ArrayBuffer | null> {
  try {
    // 去重字符，附上品牌字符集（页脚固定文案也要有字形）
    const chars = [...new Set(`${text}zynqorw.com跨境金融与AI工具实测·`)].join("");
    const cssUrl =
      `https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@${weight}` +
      `&text=${encodeURIComponent(chars)}`;
    const css = await (
      await fetch(cssUrl, {
        // 老 UA → Google 返回 truetype 而非 woff2
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 6.1; rv:10.0) Gecko/20100101 Firefox/10.0" },
        signal: AbortSignal.timeout(8000),
      })
    ).text();
    const m = css.match(/src:\s*url\((.+?)\)\s*format\(['"]?(?:opentype|truetype)['"]?\)/);
    if (!m) return null;
    const res = await fetch(m[1], { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}
