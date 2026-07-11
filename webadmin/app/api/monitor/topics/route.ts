import { db } from "@/lib/supabase";
import { checkMonitorToken } from "@/lib/monitor";
import type { MonitorTopic } from "@/lib/types";

/** Cowork 定时任务每次先取当前启用的监控话题——网站上改话题，无需改 Cowork 提示词。 */
export async function GET(request: Request) {
  const denied = checkMonitorToken(request);
  if (denied) return denied;

  const { data, error } = await db()
    .from("monitor_topics")
    .select("name, keywords, note")
    .eq("enabled", true)
    .order("position")
    .order("created_at");
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({
    topics: (data ?? []) as Pick<MonitorTopic, "name" | "keywords" | "note">[],
  });
}
