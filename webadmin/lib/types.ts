export type TrackId = "x" | "wechat";

export const TRACKS: TrackId[] = ["wechat", "x"];

export function isTrackId(v: string): v is TrackId {
  return v === "x" || v === "wechat";
}

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
  /** 计划发布日期（发布队列排序用；schema 增量 2026-07-12） */
  planned_publish_on: string | null;
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

export interface MonitorTopic {
  id: string;
  name: string;
  keywords: string | null;
  note: string | null;
  enabled: boolean;
  position: number;
  created_at: string;
}

export interface Briefing {
  id: string;
  title: string;
  body_md: string;
  item_count: number | null;
  /** daily=每日简报 weekly=每周复盘（schema 增量 2026-07-12） */
  kind: "daily" | "weekly";
  created_at: string;
}

/** 发布效果（publications.stats jsonb）：渠道各记各的，键名见 STATS_FIELDS */
export type PublicationStats = Record<string, number>;

export interface Publication {
  id: string;
  run_id: string;
  channel: string;
  title: string | null;
  published_at: string;
  stats: PublicationStats | null;
  stats_updated_at: string | null;
  notes: string | null;
}

/** 各渠道的回填指标（发布中心表单按这个渲染；channel 值与 RunWorkbench markPublished 对应） */
export const STATS_FIELDS: Record<string, { key: string; label: string }[]> = {
  wechat_clipboard: [
    { key: "reads", label: "阅读" },
    { key: "likes", label: "在看/赞" },
  ],
  x_manual: [
    { key: "impressions", label: "曝光" },
    { key: "engagements", label: "互动" },
  ],
};

export type ClipStatus = "new" | "used" | "discarded";

export interface Clip {
  id: string;
  url: string | null;
  note: string | null;
  track: TrackId | null;
  status: ClipStatus;
  used_run_id: string | null;
  created_at: string;
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
