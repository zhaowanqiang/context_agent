import "server-only";
import { spawn } from "node:child_process";
import { smartFetch } from "./proxyFetch";

/**
 * 双通道告警：本机 toast（人在电脑前）+ Telegram（人在外面）。
 * 定时产线的完成/失败都该走这个，单通道都可能看不见。
 */
export function notifyAll(title: string, body: string): void {
  notifyWindows(title, body);
  void notifyTelegram(title, body);
}

/**
 * Telegram Bot 推送：TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID 配了才发（否则空操作）。
 * sendMessage 用 GET 带参即可，直接复用 smartFetch——直连失败自动经
 * AGENT_FETCH_PROXY 走 curl，国内到 api.telegram.org 必须这条路。
 * 失败只记日志：告警是锦上添花，不能反过来弄挂产线。
 */
export async function notifyTelegram(title: string, body: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  const text = `${title}\n${body}`.slice(0, 3500); // Telegram 上限 4096，留余量
  const url =
    `https://api.telegram.org/bot${token}/sendMessage` +
    `?chat_id=${encodeURIComponent(chatId)}&text=${encodeURIComponent(text)}`;
  try {
    const res = await smartFetch(url, 10_000);
    if (!res.ok) {
      console.error("[notify] Telegram 推送失败：HTTP", res.status, (await res.text()).slice(0, 200));
    }
  } catch (e) {
    console.error("[notify] Telegram 推送失败：", (e as Error).message);
  }
}

/**
 * Windows 桌面通知（toast）：定时产线跑完后提醒，不用主动开页面。
 * 用 WinRT ToastNotification，无第三方模块依赖；失败静默（通知只是锦上添花）。
 * 脚本经 -EncodedCommand 传入，避免引号转义问题。
 */
export function notifyWindows(title: string, body: string): void {
  if (process.platform !== "win32") return;
  const script = `
$null = [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime]
$null = [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime]
$template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
$texts = $template.GetElementsByTagName("text")
$null = $texts.Item(0).AppendChild($template.CreateTextNode(${psq(title)}))
$null = $texts.Item(1).AppendChild($template.CreateTextNode(${psq(body)}))
$toast = New-Object Windows.UI.Notifications.ToastNotification($template)
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("contentagent").Show($toast)
`;
  try {
    const encoded = Buffer.from(script, "utf16le").toString("base64");
    const child = spawn("powershell", ["-NoProfile", "-NonInteractive", "-EncodedCommand", encoded], {
      windowsHide: true,
      stdio: "ignore",
      detached: true,
    });
    child.unref();
    child.on("error", () => { /* 通知失败不影响产线 */ });
  } catch { /* 同上 */ }
}

/** PowerShell 单引号字符串字面量（内部单引号翻倍转义） */
function psq(s: string): string {
  return `'${s.replace(/'/g, "''").slice(0, 200)}'`;
}
