import { Resend } from 'resend';
import { env } from '../config/env.js';

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export async function sendContactNotification(input: {
  sender_name: string;
  sender_email: string;
  subject: string;
  message: string;
}) {
  if (!resend) return { sent: false, reason: 'RESEND_API_KEY not configured' };

  await resend.emails.send({
    from: env.CONTACT_FROM_EMAIL,
    to: env.CONTACT_TO_EMAIL,
    replyTo: input.sender_email,
    subject: `[Portfolio] ${input.subject} — ${input.sender_name}`,
    text: `From: ${input.sender_name} <${input.sender_email}>\n\n${input.message}`,
  });

  return { sent: true };
}
