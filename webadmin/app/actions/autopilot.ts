"use server";

import { revalidatePath } from "next/cache";
import { runAutopilot, type AutopilotReport } from "@/lib/autopilot";

export interface AutopilotActionResult {
  error?: string;
  report?: AutopilotReport;
}

export async function triggerAutopilot(): Promise<AutopilotActionResult> {
  try {
    const report = await runAutopilot();
    revalidatePath("/");
    revalidatePath("/runs");
    revalidatePath("/topics");
    return { report };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
