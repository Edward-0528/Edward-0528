import { z } from "zod";

/** Structured result of a conversion. Missing facts are null, never invented. */
export const ResumeResultSchema = z.object({
  contact: z.object({
    name: z.string().nullable(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    location: z.string().nullable(),
  }),
  objective: z.string().nullable(),
  work_experience: z.array(
    z.object({
      title: z.string(),
      employer: z.string(),
      location: z.string().nullable(),
      start_date: z.string().nullable(),
      end_date: z.string().nullable(),
      hours_per_week: z.string().nullable(),
      salary: z.string().nullable(),
      supervisor: z.string().nullable(),
      duties: z.array(z.string()),
    }),
  ),
  education: z.array(
    z.object({
      school: z.string(),
      degree: z.string().nullable(),
      field: z.string().nullable(),
      completed: z.string().nullable(),
    }),
  ),
  certifications: z.array(z.string()),
  skills: z.array(z.string()),
  requirement_mapping: z.array(
    z.object({
      requirement: z.string(),
      strength: z.enum(["strong", "partial", "missing"]),
      evidence: z.string(),
    }),
  ),
  missing_info: z.array(z.string()),
  keywords_used: z.array(z.string()),
  notes: z.array(z.string()),
});

export type ResumeResult = z.infer<typeof ResumeResultSchema>;

export const ConvertInputSchema = z.object({
  resume: z.string().min(200, "Please paste your full resume (at least 200 characters).").max(30000, "Resume is too long (30,000 character limit)."),
  announcement: z.string().min(200, "Please paste the full job announcement (at least 200 characters).").max(30000, "Announcement is too long (30,000 character limit)."),
  confirm: z.literal(true, { message: "Please confirm you will review the output for accuracy." }),
});
