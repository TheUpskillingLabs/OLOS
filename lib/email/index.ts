import { Resend } from "resend";

export function getResendClient(): Resend {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY environment variable is not set");
  }
  return new Resend(process.env.RESEND_API_KEY);
}

const fromAddress =
  process.env.RESEND_FROM_EMAIL ?? "noreply@theupskillinglabs.org";

export const FROM_EMAIL = `Upskilling Labs <${fromAddress}>`;
