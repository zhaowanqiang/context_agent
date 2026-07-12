/**
 * Next.js 服务启动时注册定时任务（只在 PC 开机且服务运行期间生效，本地优先架构的既定取舍）：
 * - 内容产线：每天两轨道各跑一次（AUTOPILOT_CRON 覆盖，默认 08:00，off 关闭）
 * - 监控简报：每天检索监控话题出一期（BRIEFING_CRON 覆盖，默认 09:00，off 关闭）
 *
 * 错过补跑：PC 关机/睡眠错过当天 cron 时，服务启动 2 分钟后（等 Python 8600 就绪）
 * 检查运行戳（runs/cron-stamps/）自动补一次。仅生产模式生效——dev 反复重启不该触发产线。
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // dev 热重载会重复执行 register，用全局标记防重复注册
  const g = globalThis as { __autopilotCron?: boolean; __briefingCron?: boolean; __catchUp?: boolean };
  const cron = await import("node-cron");

  // ── job 本体（cron 触发和启动补跑共用；触发即写戳，失败走告警不重跑）──
  const runAutopilotJob = async (label: string) => {
    const { writeStamp } = await import("./lib/cronStamp");
    await writeStamp("autopilot");
    console.log(`[autopilot] ${new Date().toLocaleString("zh-CN")} ${label}产线启动`);
    const { runAutopilot } = await import("./lib/autopilot");
    const { TRACKS, TRACK_LABEL } = await import("./lib/types");
    const { notifyAll } = await import("./lib/notify");
    for (const track of TRACKS) {
      try {
        const report = await runAutopilot(track);
        console.log(`[autopilot:${track}] 完成：`, JSON.stringify(report, null, 1));
        const ok = report.created.filter((c) => c.ok).length;
        const retriedOk = report.retried.filter((r) => r.ok).length;
        notifyAll(
          `产线完成 · ${TRACK_LABEL[track]}`,
          `产出 ${ok} 篇待审${retriedOk ? `，补活 ${retriedOk} 篇失败稿` : ""}${report.skipped.length ? `，跳过 ${report.skipped.length}` : ""} —— 打开后台核对发布`
        );
      } catch (e) {
        console.error(`[autopilot:${track}] 失败：`, e);
        notifyAll(`产线失败 · ${TRACK_LABEL[track]}`, (e as Error).message.slice(0, 100));
      }
    }
  };

  const runBriefingJob = async (label: string) => {
    const { writeStamp } = await import("./lib/cronStamp");
    await writeStamp("briefing");
    console.log(`[briefing] ${new Date().toLocaleString("zh-CN")} ${label}简报启动`);
    const { runBriefing } = await import("./lib/briefing");
    const { notifyAll } = await import("./lib/notify");
    try {
      const report = await runBriefing();
      console.log(`[briefing] 完成：`, JSON.stringify(report, null, 1));
      notifyAll(
        "监控简报已生成",
        report.itemCount > 0
          ? `${report.title}：${report.itemCount} 条新动态 —— 打开 /monitor 查看`
          : `${report.title}：过去 24 小时无新动态`
      );
    } catch (e) {
      console.error(`[briefing] 失败：`, e);
      notifyAll("监控简报失败", (e as Error).message.slice(0, 100));
    }
  };

  // ── 注册 cron ──────────────────────────────────────────────────────
  const autopilotExpr = process.env.AUTOPILOT_CRON ?? "0 8 * * *";
  if (autopilotExpr !== "off" && !g.__autopilotCron) {
    g.__autopilotCron = true;
    cron.schedule(autopilotExpr, () => runAutopilotJob("定时"));
    console.log(`[autopilot] 定时产线已注册（cron: ${autopilotExpr}，两轨道串行）`);
  }

  const briefingExpr = process.env.BRIEFING_CRON ?? "0 9 * * *";
  if (briefingExpr !== "off" && !g.__briefingCron) {
    g.__briefingCron = true;
    cron.schedule(briefingExpr, () => runBriefingJob("定时"));
    console.log(`[briefing] 定时简报已注册（cron: ${briefingExpr}）`);
  }

  // 每周复盘：周日 20:00（纯统计零 LLM 成本；周粒度任务不进补跑——错过等下周）
  const weeklyExpr = process.env.WEEKLY_REVIEW_CRON ?? "0 20 * * 0";
  const gw = g as typeof g & { __weeklyCron?: boolean };
  if (weeklyExpr !== "off" && !gw.__weeklyCron) {
    gw.__weeklyCron = true;
    cron.schedule(weeklyExpr, async () => {
      try {
        const { runWeeklyReview } = await import("./lib/weeklyReview");
        const r = await runWeeklyReview();
        console.log(`[weekly] 周报已生成：${r.title}`);
        const { notifyAll } = await import("./lib/notify");
        notifyAll("每周复盘已生成", `${r.title} —— 打开 /monitor 查看`);
      } catch (e) {
        console.error("[weekly] 周报生成失败：", e);
      }
    });
    console.log(`[weekly] 每周复盘已注册（cron: ${weeklyExpr}）`);
  }

  // ── 启动补跑（仅生产模式；两任务串行，产线在前和 cron 顺序一致）──────
  if (process.env.NODE_ENV === "production" && !g.__catchUp) {
    g.__catchUp = true;
    setTimeout(async () => {
      try {
        const { readStamp, missedToday } = await import("./lib/cronStamp");
        if (autopilotExpr !== "off" && missedToday(autopilotExpr, await readStamp("autopilot"))) {
          await runAutopilotJob("补跑");
        }
        if (briefingExpr !== "off" && missedToday(briefingExpr, await readStamp("briefing"))) {
          await runBriefingJob("补跑");
        }
      } catch (e) {
        console.error("[catchup] 补跑检查失败：", e);
      }
    }, 120_000);
    console.log("[catchup] 启动补跑检查已排定（2 分钟后）");
  }
}
