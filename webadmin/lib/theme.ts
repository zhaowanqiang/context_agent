/**
 * 全站主题（白天 / 夜间）的共享约定。服务端 layout（内联脚本）和客户端切换按钮都读这里。
 *
 * - 默认浅色，不跟随系统；访客手动切换后记在 localStorage，下次访问沿用。
 * - 生效方式：<html data-theme="light|dark">，样式见 app/globals.css。
 * - 只有公开层参与主题。工作台（/agent、/monitor、/dashboard…）永久浅色：
 *   在公开页切到夜间后进工作台照样是浅色，回到公开页恢复原先的选择——
 *   所以「访客的选择」（localStorage）和「当前页实际主题」（data-theme）是两回事，
 *   后者 = 公开页 ? 前者 : light。
 */

export const THEME_KEY = "theme";

export type Theme = "light" | "dark";

/**
 * 参与主题的路径 = 公开层。**与 proxy.ts matcher 的公开白名单保持一致**：
 * 新增公开路由时两边一起加，漏了这里新页面就永远是浅色。
 */
const THEMED_PATH = /^\/(?:$|(?:posts|about|guides|cards|deals|on-x|tutorials)(?:\/|$))/;

export function isThemedPath(pathname: string): boolean {
  return THEMED_PATH.test(pathname);
}

/**
 * 防闪烁脚本：放在 <head> 里同步执行，赶在首屏绘制前把 data-theme 写好——
 * 否则夜间用户每次刷新都会先闪一下白屏。
 * localStorage 在隐私模式 / 禁用站点数据时会抛，所以整段包 try/catch，失败回落浅色。
 */
export const THEME_INIT_SCRIPT = `(function(){var d=document.documentElement,t="light";try{if(${THEMED_PATH}.test(location.pathname)&&localStorage.getItem("${THEME_KEY}")==="dark")t="dark"}catch(e){}d.dataset.theme=t})()`;
