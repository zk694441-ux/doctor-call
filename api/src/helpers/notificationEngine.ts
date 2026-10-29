import fs from 'fs';
import path from 'path';
import handlebars from 'handlebars';
import { Transporter } from './Transporter';
import config from '../config';

export type NotificationChannel = 'email' | 'sms' | 'whatsapp';

export type NotificationType =
  | 'appointment-confirmed'
  | 'payment-success'
  | 'payment-failed'
  | 'refund-initiated'
  | 'refund-completed'
  | 'appointment-reminder'
  | 'appointment-cancelled'
  | 'appointment-rescheduled';

export interface NotificationPayload {
  channel?: NotificationChannel;
  type: NotificationType;
  to: string;
  phone?: string;
  data: Record<string, any>;
}

const templateMap: Record<NotificationType, string> = {
  'appointment-confirmed': 'appointment.html',
  'payment-success': 'payment-success.html',
  'payment-failed': 'payment-failed.html',
  'refund-initiated': 'refund-initiated.html',
  'refund-completed': 'refund-completed.html',
  'appointment-reminder': 'appointment-reminder.html',
  'appointment-cancelled': 'appointment-cancelled.html',
  'appointment-rescheduled': 'appointment.html',
};

const subjectMap: Record<NotificationType, string> = {
  'appointment-confirmed': 'Appointment Confirmed - Doctor Appointment',
  'payment-success': 'Payment Successful - Consultation Confirmed',
  'payment-failed': 'Payment Failed - Please Retry',
  'refund-initiated': 'Refund Initiated for Your Appointment',
  'refund-completed': 'Refund Completed Successfully',
  'appointment-reminder': 'Appointment Reminder - Upcoming Consultation',
  'appointment-cancelled': 'Appointment Cancellation Notice',
  'appointment-rescheduled': 'Appointment Rescheduled Notice',
};

async function readTemplate(templateFile: string): Promise<string | null> {
  const possiblePaths = [
    path.join(__dirname, '../../../template', templateFile),
    path.join(__dirname, '../../template', templateFile),
    path.join(process.cwd(), 'template', templateFile),
    path.join(process.cwd(), 'dist', 'template', templateFile),
  ];

  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(p)) {
        return await fs.promises.readFile(p, { encoding: 'utf-8' });
      }
    } catch {
      // try next
    }
  }
  return null;
}

export async function sendNotification(options: NotificationPayload): Promise<void> {
  const { channel = 'email', type, to, phone, data } = options;

  // Extensible SMS and WhatsApp channels
  if (channel === 'sms') {
    console.log(`[Notification SMS] To: ${phone || to} | Type: ${type} | Data:`, data);
    return;
  }
  if (channel === 'whatsapp') {
    console.log(`[Notification WhatsApp] To: ${phone || to} | Type: ${type} | Data:`, data);
    return;
  }

  // Email channel
  const templateFile = templateMap[type];
  const subject = subjectMap[type] || 'Appointment Notification';

  if (!config.emailPass || config.emailPass === 'YOUR_EMAIL_APP_PASSWORD_WITH_NO_SPACE') {
    console.log(`[Notification Email] (Dev/Demo simulated) Subject: "${subject}" | To: ${to}`);
    return;
  }

  try {
    const rawHtml = await readTemplate(templateFile);
    if (!rawHtml) {
      console.warn(`[Notification] Template file ${templateFile} not found`);
      return;
    }
    const compiled = handlebars.compile(rawHtml);
    const html = compiled(data);

    await Transporter.sendMail({
      from: `<${config.adminEmail || 'noreply@doctorappointment.com'}>`,
      to,
      subject,
      html,
    });
  } catch (err: any) {
    console.error(`[Notification] Email send failed for ${type} to ${to}:`, err?.message || err);
    // Never crash caller
  }
}
