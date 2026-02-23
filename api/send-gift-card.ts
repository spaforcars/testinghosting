import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { recipientEmail, senderName, message, amount, code } = req.body as {
      recipientEmail?: string;
      senderName?: string;
      message?: string;
      amount?: number;
      code?: string;
    };

    if (!recipientEmail || !amount || !code) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: recipientEmail,
      subject: `You've received a $${amount} Gift Card from ${senderName || 'a friend'}!`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #000; padding: 20px;">
          <h1 style="text-transform: uppercase; text-align: center; border-bottom: 1px solid #000; padding-bottom: 20px;">Spa for Car</h1>
          <div style="padding: 40px 0; text-align: center;">
            <p style="font-size: 18px;">Hello!</p>
            <p>${senderName || 'Someone'} has sent you a gift card for <strong>$${amount}</strong>.</p>
            <div style="background: #000; color: #fff; padding: 20px; margin: 20px 0; font-family: monospace; font-size: 24px;">
              ${code}
            </div>
            <p style="font-style: italic;">"${message || 'Enjoy the shine!'}"</p>
            <p style="font-size: 12px; color: #666; margin-top: 40px;">Redeemable for any service at Spa for Car.</p>
          </div>
        </div>
      `,
    };

    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      await transporter.sendMail(mailOptions);
      return res.status(200).json({ success: true, message: 'Email sent successfully' });
    } else {
      console.log('Mock Email Sent:', mailOptions);
      return res.status(200).json({ success: true, message: 'Mock email sent (configure credentials to send real email)' });
    }
  } catch (error: unknown) {
    console.error('Error sending email:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
}
