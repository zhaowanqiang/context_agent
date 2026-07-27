import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveTier, type Tier } from "@/lib/decider/entitlements";

// 查某个用户对某篇教程的已购等级。
// 查询出错(比如 purchases 表还没建、RLS 拒绝)时一律按未购买处理:
// 宁可少解锁,也不能把付费内容漏出去。
export async function fetchGuideTier(
  supabase: SupabaseClient,
  userId: string,
  guideId: string
): Promise<Tier> {
  const { data, error } = await supabase
    .from("purchases")
    .select("guide_id, tier")
    .eq("user_id", userId)
    .eq("guide_id", guideId);

  if (error) {
    console.warn("[purchases] 查询购买记录失败,按未购买处理:", error.message);
    return "free";
  }

  return resolveTier(data ?? [], guideId);
}
