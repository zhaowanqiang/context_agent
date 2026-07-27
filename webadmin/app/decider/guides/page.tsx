import { redirect } from "next/navigation";

// 教程库已合并进主页(主页 = 面板 + 答题推荐)。
// 保留本路由做跳转:主站 /decider 门户和已分享出去的 /guides 链接都不断。
export default function GuidesPage() {
  redirect("/decider");
}
