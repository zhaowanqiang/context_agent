import PageSkeleton from "@/components/PageSkeleton";

// 轨道内页面间导航的即时反馈边界（根 loading 对轨道内兄弟导航不可见）
export default function Loading() {
  return <PageSkeleton />;
}
