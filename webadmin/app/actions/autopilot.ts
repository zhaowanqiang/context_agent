"use server";

import { revalidatePath } from "next/cache";
import { runAutopilot, type AutopilotReport } from "@/lib/autopilot";
import type { TrackId } from "@/lib/types";
import { requireAdmin } from "@/lib/adminAuth";

export interface AutopilotActionResult {
  error?: string;
  report?: AutopilotReport;
}

export async function triggerAutopilot(track: TrackId): Promise<AutopilotActionResult> {
  await requireAdmin();
  try {
    const report = await runAutopilot(track);
    revalidatePath(`/agent/${track}`);
    revalidatePath(`/agent/${track}/runs`);
    revalidatePath(`/agent/${track}/topics`);
    return { report };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
