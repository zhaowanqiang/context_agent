import { RunStatus, STATUS_LABEL } from "@/lib/types";

const COLORS: Record<RunStatus, string> = {
  created: "bg-neutral-100 text-neutral-700",
  outlining: "bg-blue-100 text-blue-700 animate-pulse",
  outline_review: "bg-amber-100 text-amber-800",
  drafting: "bg-blue-100 text-blue-700 animate-pulse",
  gating: "bg-blue-100 text-blue-700 animate-pulse",
  draft_review: "bg-amber-100 text-amber-800",
  published: "bg-green-100 text-green-700",
  aborted: "bg-neutral-100 text-neutral-500",
  failed: "bg-red-100 text-red-700",
};

export default function RunStatusBadge({ status }: { status: RunStatus }) {
  return (
    <span className={`inline-block shrink-0 whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium ${COLORS[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}
