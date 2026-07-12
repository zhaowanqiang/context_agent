/** 出海开户决策工具是独立应用（decider/，端口 3100，将来单独公网部署收费）。
 *  这里只做门户跳转：按访问时的 hostname 拼端口——本机 localhost、手机局域网 IP 都能通；
 *  部署公网后设 DECIDER_URL 直接指向正式域名。
 *  公网门面实例没配 DECIDER_URL 时回首页（decider 还没上线，别给访客 :3100 断链）。 */
export async function GET(request: Request) {
  const configured = process.env.DECIDER_URL;
  if (configured) return Response.redirect(configured, 307);
  if (process.env.PUBLIC_FACADE === "1") return Response.redirect(new URL("/", request.url), 307);
  const host = request.headers.get("host")?.split(":")[0] ?? "localhost";
  return Response.redirect(`http://${host}:3100`, 307);
}
