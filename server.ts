import express from 'express';
import Stripe from 'stripe';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Initialize Stripe
// NOTE: In a real app, use process.env.STRIPE_SECRET_KEY
// For this demo, we'll use a placeholder if not present, but it won't work for real payments without a key.
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  apiVersion: '2025-02-24.acacia', // Use latest API version
});

// Initialize Nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail', // Or your email provider
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// API Routes

// 1. Create Payment Intent
app.post('/api/create-payment-intent', async (req, res) => {
  try {
    const { amount, currency = 'usd' } = req.body;

    if (!amount) {
      return res.status(400).json({ error: 'Amount is required' });
    }

    // Create a PaymentIntent with the order amount and currency
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100, // Stripe expects amount in cents
      currency: currency,
      automatic_payment_methods: {
        enabled: true,
      },
    });

    res.send({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error: any) {
    console.error('Error creating payment intent:', error);
    res.status(500).send({ error: error.message });
  }
});

// 2. Send Gift Card Email
app.post('/api/send-gift-card', async (req, res) => {
  try {
    const { recipientEmail, senderName, message, amount, code } = req.body;

    if (!recipientEmail || !amount || !code) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: recipientEmail,
      subject: `You've received a $${amount} Gift Card from ${senderName || 'a friend'}!`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #000; padding: 20px;">
          <h1 style="text-transform: uppercase; text-align: center; border-bottom: 1px solid #000; padding-bottom: 20px;">Spa for Cars</h1>
          <div style="padding: 40px 0; text-align: center;">
            <p style="font-size: 18px;">Hello!</p>
            <p>${senderName || 'Someone'} has sent you a gift card for <strong>$${amount}</strong>.</p>
            <div style="background: #000; color: #fff; padding: 20px; margin: 20px 0; font-family: monospace; font-size: 24px;">
              ${code}
            </div>
            <p style="font-style: italic;">"${message || 'Enjoy the shine!'}"</p>
            <p style="font-size: 12px; color: #666; margin-top: 40px;">Redeemable for any service at Spa for Cars.</p>
          </div>
        </div>
      `,
    };

    // Only attempt to send if credentials exist
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        await transporter.sendMail(mailOptions);
        res.json({ success: true, message: 'Email sent successfully' });
    } else {
        console.log('Mock Email Sent:', mailOptions);
        res.json({ success: true, message: 'Mock email sent (configure credentials to send real email)' });
    }

  } catch (error: any) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: error.message });
  }
});

// Vite Middleware for Development
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production static file serving would go here
    // app.use(express.static('dist'));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
