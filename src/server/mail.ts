// Отправка писем через SMTP. Настройки — только в переменных окружения:
// SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_SECURE ("true" для 465), MAIL_FROM.
// Если SMTP не настроен, письмо не отправляется — вызывающий код показывает ссылку для ручной передачи.
import nodemailer from "nodemailer";
import { CONTACT_EMAIL } from "@/core/billing";

export const mailConfigured = () => Boolean(process.env.SMTP_HOST?.trim());

export async function sendMail(opts: { to: string; subject: string; text: string; html?: string }): Promise<{ sent: boolean; error?: string }> {
  if (!mailConfigured()) return { sent: false, error: "Почта для отправки не настроена (SMTP_HOST)" };
  try {
    const t = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD ?? "" } : undefined,
    });
    await t.sendMail({ from: process.env.MAIL_FROM || `ЭВМО <${CONTACT_EMAIL}>`, ...opts });
    return { sent: true };
  } catch (e) {
    console.error("Письмо не отправлено", e);
    return { sent: false, error: "Не удалось отправить письмо" };
  }
}
