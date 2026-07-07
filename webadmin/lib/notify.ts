import "server-only";
import { spawn } from "node:child_process";

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
