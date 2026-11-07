import { convertResume, publicErrorMessage, type ConvertOutput } from "./convert";

/** Database operations the job runner needs (implemented over Supabase RPCs; faked in tests). */
export type JobStore = {
  complete(jobId: string, out: ConvertOutput): Promise<void>;
  fail(jobId: string, message: string): Promise<void>;
};

export type Converter = (resume: string, announcement: string) => Promise<ConvertOutput>;

/**
 * Run one conversion. Always ends in complete() or fail(); fail() refunds the credit.
 * Never throws, so it is safe to run inside after().
 */
export async function runJob(
  jobId: string,
  resume: string,
  announcement: string,
  store: JobStore,
  convert: Converter = (r, a) => convertResume(r, a),
): Promise<"done" | "failed"> {
  try {
    const out = await convert(resume, announcement);
    await store.complete(jobId, out);
    return "done";
  } catch (err) {
    console.error("job failed", jobId, err instanceof Error ? err.message : err);
    try {
      await store.fail(jobId, publicErrorMessage(err));
    } catch (e) {
      console.error("could not mark job failed", jobId, e);
    }
    return "failed";
  }
}

export const STUCK_AFTER_MS = 10 * 60 * 1000;

/** A job still "running" long after it started was killed (e.g. function timeout). */
export function isStuck(status: string, createdAt: string, now = Date.now()): boolean {
  return status === "running" && now - new Date(createdAt).getTime() > STUCK_AFTER_MS;
}
