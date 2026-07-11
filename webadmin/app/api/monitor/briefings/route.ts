import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import { checkMonitorToken } from "@/lib/monitor";

/** Cowork 跑完检索后把整理好的简报 POST 回来：{ title, body_md, item_count? } */
export async function POST(request: Request) {
  const denied = checkMonitorToken(request);
  if (denied) return denied;

  let body: { title?: unknown; body_md?: unknown; item_count?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const bodyMd = typeof body.body_md === "string" ? body.body_md.trim() : "";
  if (!title || !bodyMd) {
    return Response.json({ error: "title 和 body_md 不能为空" }, { status: 400 });
  }
  const itemCount =
    typeof body.item_count === "number" && Number.isFinite(body.item_count)
      ? Math.max(0, Math.round(body.item_count))
      : null;

  const { data, error } = await db()
    .from("briefings")
    .insert({ title, body_md: bodyMd, item_count: itemCount })
    .select("id")
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });

  revalidatePath("/monitor");
  revalidatePath("/");
  return Response.json({ ok: true, id: data.id, url: `/monitor/${data.id}` }, { status: 201 });
}
