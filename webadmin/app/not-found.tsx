import Link from "next/link";

/** 品牌化 404：和暖色体系一致，别让迷路的访客看到 Next 默认页 */
export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-start py-24">
      <p className="font-display text-6xl font-bold tracking-tight text-neutral-200">
        404<span className="text-amber-400">.</span>
      </p>
      <h1 className="mt-4 text-xl font-bold text-neutral-900">这一页不存在（或已下架）</h1>
      <p className="mt-2 text-[14px] leading-relaxed text-neutral-500">
        链接可能拼错了，或者这篇内容被我收回去返工了。
      </p>
      <div className="mt-6 flex gap-4 text-[13.5px]">
        <Link href="/" className="font-medium text-amber-700 underline decoration-amber-300 underline-offset-4 hover:text-amber-800">
          回首页
        </Link>
        <Link href="/posts" className="text-neutral-500 underline decoration-neutral-300 underline-offset-4 hover:text-neutral-800">
          看全部文章
        </Link>
      </div>
    </div>
  );
}
