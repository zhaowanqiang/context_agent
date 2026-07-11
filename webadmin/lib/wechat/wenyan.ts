/**
 * 基于 @wenyan-md/core 的多主题公众号排版（浏览器专用，预览跟随编辑实时渲染）。
 * 该包静态引入 mathjax 等重依赖，这里全部走动态 import 按需加载，不进首屏 bundle。
 * "plain" 主题保留原自写渲染器（外链渲染为「文字（链接：url）」明文）。
 */
import type { WenyanCoreInstance } from "@wenyan-md/core";
import { renderWechatHtml } from "./render";

export const WECHAT_THEMES: { id: string; name: string }[] = [
  { id: "default", name: "Default 经典" },
  { id: "lapis", name: "Lapis 青蓝" },
  { id: "orangeheart", name: "OrangeHeart 暖橙" },
  { id: "rainbow", name: "Rainbow 彩虹" },
  { id: "pie", name: "Pie 少数派" },
  { id: "maize", name: "Maize 玉米黄" },
  { id: "purple", name: "Purple 紫韵" },
  { id: "phycat", name: "Phycat 物理猫" },
  { id: "plain", name: "极简（原内置）" },
];

let corePromise: Promise<WenyanCoreInstance> | null = null;

function getCore(): Promise<WenyanCoreInstance> {
  if (!corePromise) {
    corePromise = (async () => {
      const wy = await import("@wenyan-md/core");
      wy.registerAllBuiltInThemes();
      wy.registerBuiltInHlThemes();
      // 公众号文章不含数学公式，关掉 MathJax；mermaid 同理
      return wy.createWenyanCore({ isConvertMathJax: false, isWechat: true, mermaid: false });
    })();
  }
  return corePromise;
}

/** markdown → 指定主题的公众号内联 HTML；wenyan 渲染失败时退回 plain */
export async function renderWechatHtmlThemed(markdown: string, themeId: string): Promise<string> {
  if (themeId === "plain") return renderWechatHtml(markdown);
  try {
    const core = await getCore();
    // 主题 CSS 以 #wenyan 为根选择器，包装元素必须带这个 id
    const section = document.createElement("section");
    section.id = "wenyan";
    section.innerHTML = await core.renderMarkdown(markdown);
    return await core.applyStylesWithTheme(section, {
      themeId,
      hlThemeId: "github",
      isMacStyle: true,
      isAddFootnote: true, // 公众号会剥离正文外链，转成文末「引用链接」脚注
    });
  } catch (e) {
    console.error("wenyan 渲染失败，退回极简主题", e);
    return renderWechatHtml(markdown);
  }
}
