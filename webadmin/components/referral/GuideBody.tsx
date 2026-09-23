import { getReferral } from "@/data/referrals";
import { splitGuideBlocks } from "@/lib/guideBlocks";
import { renderMarkdown } from "@/lib/markdown";
import ReferralCard from "./ReferralCard";

/**
 * 教程正文渲染：markdown 段照常出 HTML，::referral{} 标记段出返佣卡片。
 *
 * 未知 id（拼错、或产品下架后从注册表删了）**静默跳过**——教程正文里
 * 冒出一行红字报错，对访客毫无意义。发布闸门会在上站前拦住无效引用
 * （见 app/actions/guides.ts），所以能走到这一步的错引用只可能是
 * 上站之后才删的产品，那时候少一张卡正是想要的行为。
 */
export default function GuideBody({ markdown }: { markdown: string }) {
  const blocks = splitGuideBlocks(markdown);

  return (
    <div className="md-body md-article">
      {blocks.map((b, i) => {
        if (b.kind === "md") {
          return (
            <div key={i} dangerouslySetInnerHTML={{ __html: renderMarkdown(b.markdown) }} />
          );
        }
        const r = getReferral(b.id);
        if (!r) return null;
        return <ReferralCard key={i} referral={r} from="guide_inline" variant="inline" />;
      })}
    </div>
  );
}
