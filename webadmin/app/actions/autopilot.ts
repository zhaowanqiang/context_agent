"use server";

import { revalidatePath } from "next/cache";
import { runAutopilot, type AutopilotReport } from "@/lib/autopilot";
import type { TrackId } from "@/lib/types";

export interface AutopilotActionResult {
  error?: string;
  report?: AutopilotReport;
}

export async function triggerAutopilot(track: TrackId): Promise<AutopilotActionResult> {
  try {
    const report = await runAutopilot(track);
    revalidatePath(`/${track}`);
    revalidatePath(`/${track}/runs`);
    revalidatePath(`/${track}/topics`);
    return { report };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
