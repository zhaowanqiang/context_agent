export type TrackId = "x" | "wechat";

export type RunStatus =
  | "created"
  | "outlining"
  | "outline_review"
  | "drafting"
  | "gating"
  | "draft_review"
  | "published"
  | "aborted"
  | "failed";

export type FeedItemStatus = "new" | "scored" | "shortlisted" | "used" | "discarded";

export interface Run {
  id: string;
  track: TrackId;
  status: RunStatus;
  feed_item_id: string | null;
  title: string | null;
  material: string;
  outline_generated: string | null;
  outline_final: string | null;
  outline_edited: boolean | null;
  draft: string | null;
  draft_final: string | null;
  checklist: string | null;
  models: { strong: string; gate: string } | null;
  token_usage: { input_tokens: number; output_tokens: number } | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface Source {
  id: string;
  track: TrackId;
  name: string;
  feed_url: string;
  enabled: boolean;
  last_fetched_at: string | null;
  last_error: string | null;
  created_at: string;
}

export interface FeedItem {
  id: string;
  source_id: string;
  track: TrackId;
  guid: string;
  title: string;
  link: string;
  summary: string | null;
  published_at: string | null;
  fetched_at: string;
  status: FeedItemStatus;
  score: number | null;
  suggested_angle: string | null;
  score_reason: string | null;
}

export const TRACK_LABEL: Record<TrackId, string> = {
  x: "X 干货帖",
  wechat: "公众号长文",
};

export const STATUS_LABEL: Record<RunStatus, string> = {
  created: "待出大纲",
  outlining: "大纲生成中…",
  outline_review: "等你改大纲",
  drafting: "成稿生成中…",
  gating: "Gate 检查中…",
  draft_review: "等你核对/润色",
  published: "已发布",
  aborted: "已放弃",
  failed: "失败（可重试）",
};
