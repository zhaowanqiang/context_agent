import "server-only";
import { fetchArticle } from "./fetchArticle";
import { fetchRepoMaterial, isGitHubRepoLink } from "./github";

/** 选题底料：普通文章走原文抓取；GitHub 仓库走 API（档案 + README） */
export interface SeedContent {
  kind: "article" | "github";
  text: string;
  images: string[];
}

export async function fetchSeedContent(link: string): Promise<SeedContent | null> {
  if (isGitHubRepoLink(link)) {
    const repo = await fetchRepoMaterial(link);
    return repo ? { kind: "github", ...repo } : null;
  }
  const article = await fetchArticle(link);
  return article ? { kind: "article", ...article } : null;
}

/**
 * 拼创作素材。段落头（【原文全文】【原文图片】等）是 prompt 的契约，
 * 与 contentagent/prompts.py 的铁律措辞对应，不要随意改名。
 */
export function assembleMaterial(
  seed: { title: string; suggested_angle: string | null; link: string },
  content: SeedContent | null,
  myNotes: string
): string {
  if (content?.kind === "github") {
    return [
      `【选题】${seed.title}`,
      `【建议角度】${seed.suggested_angle ?? "（无）"}`,
      `【原文链接】${seed.link}`,
      ``,
      `【原文全文】（GitHub 仓库档案 + README，信息来源即官方仓库）`,
      content.text,
      ``,
      `【原文图片】`,
      content.images.length > 0
        ? content.images.map((u, i) => `${i + 1}. ${u}`).join("\n")
        : "（README 无可用配图，不要写 [配图] 占位，纯文字即可）",
      ``,
      `【创作要求】`,
      `这是一篇 GitHub 开源库短篇推介，不是长文解读：`,
      `- 只讲三件事：这个库解决什么问题、核心特点与功能（挑最有辨识度的 2-4 个）、为什么值得关注`,
      `- 篇幅：公众号全文控制在 600–900 字（比常规解读文短一半），X 帖照常规帖长度；`,
      `  在大纲末尾加一行「（成稿要求：全文 600–900 字，结尾附仓库地址）」传给成稿环节`,
      `- 结尾单独一段给出仓库地址：${seed.link}`,
      `- 配图只从【原文图片】里选 1-2 张直接用 markdown 嵌入，绝不另写 [配图：…] 占位`,
      `- README 里没有的性能数据和使用效果不编造`,
      ``,
      `【我的补充观点】`,
      myNotes,
    ].join("\n");
  }
  return [
    `【选题】${seed.title}`,
    `【建议角度】${seed.suggested_angle ?? "（无）"}`,
    `【原文链接】${seed.link}`,
    ``,
    `【原文全文】`,
    content?.text ?? "（自动抓取失败——打开上面的原文链接，把正文复制粘贴到这里）",
    ``,
    `【原文图片】`,
    content && content.images.length > 0
      ? content.images.map((u, i) => `${i + 1}. ${u}`).join("\n")
      : "（原文无可用图片）",
    ``,
    `【我的补充观点】`,
    myNotes,
  ].join("\n");
}
