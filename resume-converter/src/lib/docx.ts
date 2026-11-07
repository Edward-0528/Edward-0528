import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import type { ResumeResult } from "./schema";

const h = (text: string) => new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 80 } });
const p = (text: string) => new Paragraph({ children: [new TextRun(text)], spacing: { after: 80 } });
const bullet = (text: string) => new Paragraph({ text, bullet: { level: 0 } });
const line = (label: string, value: string | null) =>
  value ? new Paragraph({ children: [new TextRun({ text: `${label}: `, bold: true }), new TextRun(value)] }) : null;

/** Build the editable resume DOCX. Unknown fields are shown as a visible placeholder to fill in. */
export async function buildDocx(r: ResumeResult): Promise<Buffer> {
  const children: Paragraph[] = [];
  const nn = <T,>(x: T | null): x is T => x !== null;

  children.push(new Paragraph({ text: r.contact.name || "[YOUR NAME]", heading: HeadingLevel.TITLE }));
  const contactLine = [r.contact.email, r.contact.phone, r.contact.location].filter(Boolean).join("  |  ");
  if (contactLine) children.push(p(contactLine));

  if (r.objective) children.push(h("Summary"), p(r.objective));

  if (r.work_experience.length) children.push(h("Work Experience"));
  for (const w of r.work_experience) {
    const dates = [w.start_date, w.end_date].filter(Boolean).join(" to ");
    children.push(
      new Paragraph({ children: [new TextRun({ text: `${w.title}, ${w.employer}`, bold: true })], spacing: { before: 160 } }),
    );
    [
      line("Dates", dates || "[ADD DATES]"),
      line("Location", w.location),
      line("Hours per week", w.hours_per_week ?? "[ADD HOURS PER WEEK]"),
      line("Salary", w.salary ?? "[ADD SALARY]"),
      line("Supervisor", w.supervisor ?? "[ADD SUPERVISOR NAME AND PHONE]"),
    ]
      .filter(nn)
      .forEach((x) => children.push(x));
    for (const d of w.duties) children.push(bullet(d));
  }

  if (r.education.length) children.push(h("Education"));
  for (const e of r.education) {
    const parts = [e.degree, e.field].filter(Boolean).join(", ");
    children.push(p([e.school, parts, e.completed].filter(Boolean).join(" | ")));
  }

  if (r.certifications.length) {
    children.push(h("Certifications"));
    r.certifications.forEach((c) => children.push(bullet(c)));
  }
  if (r.skills.length) {
    children.push(h("Skills"), p(r.skills.join(", ")));
  }

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "Review every line for accuracy before submitting. Replace all [ADD ...] placeholders. Delete this note.",
          italics: true,
        }),
      ],
      spacing: { before: 360 },
    }),
  );

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}
