/**
 * Next.js 服务启动时注册定时任务：每天自动跑一次产线。
 * 只在 PC 开机且 start.ps1 运行期间生效（本地优先架构的既定取舍）。
 * 时间可用 AUTOPILOT_CRON 覆盖（默认每天 08:00），设 AUTOPILOT_CRON=off 关闭。
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const cronExpr = process.env.AUTOPILOT_CRON ?? "0 8 * * *";
  if (cronExpr === "off") return;

  // dev 热重载会重复执行 register，用全局标记防重复注册
  const g = globalThis as { __autopilotCron?: boolean };
  if (g.__autopilotCron) return;
  g.__autopilotCron = true;

  const cron = await import("node-cron");
  cron.schedule(cronExpr, async () => {
    console.log(`[autopilot] ${new Date().toLocaleString("zh-CN")} 定时产线启动`);
    try {
      const { runAutopilot } = await import("./lib/autopilot");
      const report = await runAutopilot();
      console.log("[autopilot] 完成：", JSON.stringify(report, null, 1));
    } catch (e) {
      console.error("[autopilot] 失败：", e);
    }
  });
  console.log(`[autopilot] 定时产线已注册（cron: ${cronExpr}）`);
}
