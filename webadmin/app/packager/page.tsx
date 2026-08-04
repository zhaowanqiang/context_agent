import type { Metadata } from "next";
import Link from "next/link";
import { listAllGuides, type Guide } from "@/lib/guides";
import TutorialPackager, { type GuidePick } from "@/components/TutorialPackager";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "教程装配台" };

/* 私有层：把正文 + 截图装配成带封面/目录/购买者水印的可售卖成品（PDF / 单文件 HTML）。
   与 /import 的分工：/import 产出的是站内公开阅读的教程（存 Supabase，走 /guides）；
   装配台产出的是**离站的文件**，卖给谁就带谁的水印，因此全程留在浏览器里，不落库。
   两端在这里接上：装配台可以直接把已有教程的正文和配图载进来。 */
export default async function PackagerPage() {
  let guides: Guide[] = [];
  let dbError: string | null = null;
  try {
    guides = await listAllGuides();
  } catch (e) {
    dbError = (e as Error).message;
  }
  // 只把选择器需要的三个字段传给客户端——content_md 全量下发是白白多传几百 KB，
  // 真正要用哪一篇，点「载入」时再走 server action 单篇取
  const picks: GuidePick[] = guides.map((g) => ({
    id: g.id,
    title: g.title,
    status: g.status,
  }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-neutral-900">教程装配台</h1>
        <p className="mt-1 text-[12.5px] leading-relaxed text-neutral-400">
          正文 + 截图 → 带封面、目录、购买者水印的成品，导出 PDF 或单文件 HTML。
          可以从{" "}
          <Link href="/import" className="text-amber-700 underline underline-offset-2 hover:text-amber-900">
            教程导入
          </Link>{" "}
          已有的教程载入正文，也可以用 X 抓取脚本现抓一篇。图片只在浏览器里，不上传服务器。
        </p>
      </div>

      {dbError && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[12.5px] text-amber-900">
          教程列表读取失败：{dbError}
          <br />
          装配台其余功能不受影响——粘正文、拖图片、导出都能照常用。
        </p>
      )}

      <TutorialPackager
        guides={picks}
        today={new Date().toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" })}
      />
    </div>
  );
}
