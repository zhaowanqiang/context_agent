import "server-only";
import { db } from "./supabase";
import { TRACK_LABEL, TRACKS } from "./types";

/**
 * 每周复盘：纯确定性统计（零 LLM 成本——数字不需要模型来算），
 * 落 briefings 表（kind=weekly），周日晚 cron 自动生成。
 * 把 dashboard 的「当下快照」补成「本周趋势」。
 */

export interface WeeklyReport {
  briefingId: string;
  title: string;
}

function yuanEstimate(tokens: number): string {
  return ((tokens / 1_000_000) * 4).toFixed(1); // DeepSeek 混合计价粗估
}

export async function runWeeklyReview(): Promise<WeeklyReport> {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const since = monday.toISOString();

  const [perTrack, llm, pubs, posts, briefs, xposts, pendingNow] = await Promise.all([
    Promise.all(
      TRACKS.map(async (t) => {
        const [{ count: published }, { count: created }] = await Promise.all([
          db().from("runs").select("*", { count: "exact", head: true })
            .eq("track", t).eq("status", "published").gte("updated_at", since),
          db().from("runs").select("*", { count: "exact", head: true })
            .eq("track", t).gte("created_at", since),
        ]);
        return { track: t, published: published ?? 0, created: created ?? 0 };
      })
    ),
    db().from("llm_calls").select("input_tokens, output_tokens").gte("created_at", since).limit(3000),
    db().from("publications").select("stats").gte("published_at", since),
    db().from("posts").select("*", { count: "exact", head: true }).gte("published_at", since),
    db().from("briefings").select("item_count").eq("kind", "daily").gte("created_at", since),
    db().from("runs").select("*", { count: "exact", head: true })
      .eq("track", "x").like("material", "【简报选题%").gte("created_at", since),
    db().from("runs").select("*", { count: "exact", head: true })
      .in("status", ["outline_review", "draft_review", "failed"]),
  ]);

  const tokens = (llm.data ?? []).reduce((s, r) => s + r.input_tokens + r.output_tokens, 0);
  const calls = llm.data?.length ?? 0;
  const pubCount = pubs.data?.length ?? 0;
  const statsFilled = (pubs.data ?? []).filter((p) => p.stats).length;
  const briefCount = briefs.data?.length ?? 0;
  const briefItems = (briefs.data ?? []).reduce((s, b) => s + (b.item_count ?? 0), 0);

  const dateStr = now.toLocaleDateString("sv-SE");
  const title = `每周复盘 - ${dateStr}`;
  const weekRange = `${monday.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })} – ${now.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })}`;

  const totalPublished = perTrack.reduce((s, t) => s + t.published, 0);
  const lines = [
    `## 本周产出（${weekRange}）`,
    ...perTrack.map(
      (t) => `- **${TRACK_LABEL[t.track]}**：发布 ${t.published} 篇 · 新开 run ${t.created} 个`
    ),
    `- 平台发布记录 ${pubCount} 次（效果已回填 ${statsFilled}）· 个人站回流 ${posts.count ?? 0} 篇`,
    ``,
    `## 情报与选题`,
    `- 监控简报 ${briefCount} 期，产出选题 ${briefItems} 条，转 X 帖 ${xposts.count ?? 0} 篇`,
    ``,
    `## 成本`,
    `- LLM 调用 ${calls} 次 · ${(tokens / 1000).toFixed(1)}K token · 约 ¥${yuanEstimate(tokens)}`,
    ``,
    `## 待办水位`,
    `- 当前积压 ${pendingNow.count ?? 0} 项（待审/失败）——${(pendingNow.count ?? 0) > 10 ? "偏高，先清积压再开新 run" : "健康"}`,
    ...(totalPublished === 0 ? ["", "> 本周零发布——产线产出在积压里等审，别让它白跑。"] : []),
  ];

  const { data: row, error } = await db()
    .from("briefings")
    .insert({ title, body_md: lines.join("\n"), item_count: null, kind: "weekly" })
    .select("id")
    .single();
  if (error) throw new Error(`周报入库失败：${error.message}`);
  return { briefingId: row.id, title };
}
