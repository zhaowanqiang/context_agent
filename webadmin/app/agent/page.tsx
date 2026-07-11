import { redirect } from "next/navigation";

/** 平台选择页已废弃：轨道页内自带两轨切换器，/agent 直接进默认轨道 */
export default function AgentIndex() {
  redirect("/agent/wechat");
}
