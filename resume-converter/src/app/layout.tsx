import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Federal Resume Converter: USAJOBS-style resumes from your resume",
  description:
    "Paste your resume and a USAJOBS announcement. Get a federal-format resume mapped to the announcement's requirements, with a gap list and an editable DOCX.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
