import { config } from "@/server/config";

export type EmailMessage = { to: string; subject: string; text: string; html: string };

/**
 * Sends email via Resend when configured. Without a provider, links are logged in development
 * so flows can still be exercised; in production the message is dropped with a warning.
 */
export async function sendEmail(msg: EmailMessage): Promise<{ delivered: boolean }> {
  if (config.email.resendKey) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.email.resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: config.email.from, to: msg.to, subject: msg.subject, text: msg.text, html: msg.html }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[email] provider error ${res.status}`, detail.slice(0, 500));
      let message = "Couldn't send that email.";
      try {
        const parsed = JSON.parse(detail) as { message?: string };
        if (parsed.message) message = parsed.message;
      } catch {
        /* keep generic message */
      }
      throw new Error(message);
    }
    return { delivered: true };
  }
  if (!config.isProd) {
    console.info(`\n[email:dev] to=${msg.to} subject="${msg.subject}"\n${msg.text}\n`);
  } else {
    console.warn("[email] no provider configured; message not sent");
  }
  return { delivered: false };
}

function layout(title: string, body: string, cta: { label: string; url: string }) {
  return `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;padding:24px;color:#111">
<h1 style="font-size:22px;margin:0 0 12px">${title}</h1><p style="line-height:1.5">${body}</p>
<p><a href="${cta.url}" style="display:inline-block;background:#c8f031;color:#0b0d06;padding:12px 20px;border-radius:8px;font-weight:700;text-decoration:none">${cta.label}</a></p>
<p style="color:#666;font-size:12px">If the button doesn't work, paste this link into your browser:<br>${cta.url}</p></div>`;
}

export function verificationEmail(to: string, name: string, token: string): EmailMessage {
  const url = `${config.appUrl}/verify-email?token=${token}`;
  return {
    to,
    subject: "Verify your LIFTED email",
    text: `Hi ${name}, confirm your email: ${url}\nThis link expires in 24 hours.`,
    html: layout("Confirm your email", `Hi ${escapeHtml(name)}, confirm your email to finish setting up LIFTED. This link expires in 24 hours.`, {
      label: "Verify email",
      url,
    }),
  };
}

export function passwordResetEmail(to: string, name: string, token: string): EmailMessage {
  const url = `${config.appUrl}/reset-password?token=${token}`;
  return {
    to,
    subject: "Reset your LIFTED password",
    text: `Hi ${name}, reset your password: ${url}\nThis link expires in 1 hour. If you didn't ask for this, ignore this email.`,
    html: layout("Reset your password", `Hi ${escapeHtml(name)}, use the button below to choose a new password. This link expires in 1 hour. If you didn't ask for this, you can ignore this email.`, {
      label: "Reset password",
      url,
    }),
  };
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
