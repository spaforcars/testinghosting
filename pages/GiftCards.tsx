import React, { useEffect, useMemo, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import Button from '../components/Button';
import { useCmsPage } from '../hooks/useCmsPage';
import { defaultGiftCardsPageContent } from '../lib/cmsDefaults';
import { adaptGiftCardsContent } from '../lib/contentAdapter';
import { resolveApiUrl } from '../lib/apiClient';

const stripePublicKey =
  (typeof window !== 'undefined' &&
    (window as Window & { __STRIPE_PUBLISHABLE_KEY__?: string }).__STRIPE_PUBLISHABLE_KEY__) ||
  'pk_test_51O...placeholder';

const stripePromise = loadStripe(stripePublicKey);

const CheckoutForm: React.FC<{
  amount: number;
  recipientEmail: string;
  senderName: string;
  message: string;
  onSuccess: () => void;
}> = ({ amount, recipientEmail, senderName, message, onSuccess }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsLoading(true);
    setErrorMessage(null);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/gift-cards`,
      },
      redirect: 'if_required',
    });

    if (error) {
      setErrorMessage(error.message || 'An unexpected error occurred.');
      setIsLoading(false);
      return;
    }

    if (paymentIntent?.status === 'succeeded') {
      try {
        await fetch(resolveApiUrl('/api/send-gift-card'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipientEmail,
            senderName,
            message,
            amount,
            code: `GC-${Math.random().toString(36).slice(2, 11).toUpperCase()}`,
          }),
        });
        onSuccess();
      } catch {
        setErrorMessage('Payment succeeded but gift card delivery failed. Please contact support.');
      }
    } else {
      setErrorMessage('Payment is still processing. Please wait a moment and retry.');
    }

    setIsLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <PaymentElement />
      {errorMessage && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </div>
      )}
      <Button fullWidth disabled={isLoading || !stripe || !elements}>
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : `Pay $${amount}`}
      </Button>
    </form>
  );
};

const GiftCards: React.FC = () => {
  const { data: cmsData } = useCmsPage('gift-cards', defaultGiftCardsPageContent);
  const content = adaptGiftCardsContent(cmsData);
  const [step, setStep] = useState<'config' | 'payment' | 'success'>('config');
  const [selectedAmount, setSelectedAmount] = useState(100);
  const [customAmount, setCustomAmount] = useState('');
  const [customEnabled, setCustomEnabled] = useState(false);
  const [clientSecret, setClientSecret] = useState('');
  const [isCreatingPayment, setIsCreatingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    recipientEmail: '',
    senderName: '',
    message: '',
  });

  const effectiveAmount = useMemo(() => {
    if (!customEnabled) return selectedAmount;
    const parsed = Number(customAmount);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [customAmount, customEnabled, selectedAmount]);

  useEffect(() => {
    if (content.presetAmounts.length === 0) return;
    if (!content.presetAmounts.includes(selectedAmount) && !customEnabled) {
      setSelectedAmount(content.presetAmounts[0]);
    }
  }, [content.presetAmounts, customEnabled, selectedAmount]);

  const canProceed =
    formData.recipientEmail.trim().length > 0 &&
    formData.senderName.trim().length > 0 &&
    effectiveAmount >= content.minCustomAmount;

  const updateField =
    (field: 'recipientEmail' | 'senderName' | 'message') =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const initiatePayment = async () => {
    if (!canProceed || isCreatingPayment) return;

    setIsCreatingPayment(true);
    setPaymentError(null);

    try {
      const res = await fetch(resolveApiUrl('/api/create-payment-intent'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Math.round(effectiveAmount) }),
      });

      if (!res.ok) {
        throw new Error('Unable to initialize secure payment.');
      }

      const data = await res.json();
      if (!data?.clientSecret) {
        throw new Error('Payment session is invalid. Please try again.');
      }

      setClientSecret(data.clientSecret);
      setStep('payment');
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : 'Something went wrong while starting payment.');
    } finally {
      setIsCreatingPayment(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-gray">
      <section className="border-b border-neutral-200 bg-gradient-to-b from-white to-neutral-50 px-4 py-16 md:py-20">
        <div className="mx-auto max-w-7xl">
          <span className="inline-block rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-brand-mclaren">
            {content.badge}
          </span>
          <h1 className="mt-5 max-w-4xl font-display text-4xl font-bold uppercase leading-[0.95] text-brand-black md:text-6xl">
            {content.title}
          </h1>
          <p className="mt-6 max-w-3xl text-base leading-relaxed text-gray-600 md:text-lg">
            {content.subtitle}
          </p>
        </div>
      </section>

      <section className="px-4 py-16 md:py-20">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-2">
          <aside className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
            <div className="relative overflow-hidden rounded-xl bg-brand-black p-6 text-white">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,122,0,0.24),transparent_60%)]" />
              <div className="relative">
                <p className="text-xs uppercase tracking-[0.08em] text-neutral-300">{content.cardBrand}</p>
                <p className="mt-2 font-display text-3xl font-semibold uppercase">{content.cardTitle}</p>
                <p className="mt-12 text-4xl font-bold">${Math.round(effectiveAmount)}</p>
                <p className="mt-3 text-sm text-neutral-300">{content.cardTagline}</p>
              </div>
            </div>
            <div className="mt-8 space-y-3 text-sm text-gray-600">
              {content.benefits.map((item) => (
                <div key={item} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 text-brand-mclaren" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </aside>

          <div className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
            {step === 'config' && (
              <>
                <h2 className="font-display text-3xl font-semibold uppercase text-brand-black">
                  {content.configureTitle}
                </h2>

                <div className="mt-6">
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">
                    Choose Amount
                  </label>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {content.presetAmounts.map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        onClick={() => {
                          setCustomEnabled(false);
                          setSelectedAmount(amount);
                        }}
                        className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                          !customEnabled && selectedAmount === amount
                            ? 'border-brand-mclaren bg-orange-50 text-brand-mclaren'
                            : 'border-neutral-300 bg-white text-gray-700 hover:border-brand-mclaren hover:text-brand-mclaren'
                        }`}
                      >
                        ${amount}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setCustomEnabled(true)}
                      className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                        customEnabled
                          ? 'border-brand-mclaren bg-orange-50 text-brand-mclaren'
                          : 'border-neutral-300 bg-white text-gray-700 hover:border-brand-mclaren hover:text-brand-mclaren'
                      }`}
                    >
                      Custom
                    </button>
                  </div>

                  {customEnabled && (
                    <div className="mt-3">
                      <input
                        type="number"
                        min={content.minCustomAmount}
                        value={customAmount}
                        onChange={(e) => setCustomAmount(e.target.value)}
                        placeholder={`Minimum $${content.minCustomAmount}`}
                        className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-sm text-brand-black focus:border-brand-mclaren focus:outline-none"
                      />
                    </div>
                  )}
                </div>

                <div className="mt-6 space-y-4">
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">
                      {content.recipientEmailLabel}
                    </label>
                    <input
                      type="email"
                      value={formData.recipientEmail}
                      onChange={updateField('recipientEmail')}
                      placeholder="friend@example.com"
                      className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-sm text-brand-black focus:border-brand-mclaren focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">
                      {content.senderNameLabel}
                    </label>
                    <input
                      type="text"
                      value={formData.senderName}
                      onChange={updateField('senderName')}
                      placeholder="Your Name"
                      className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-sm text-brand-black focus:border-brand-mclaren focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">
                      {content.messageLabel}
                    </label>
                    <textarea
                      value={formData.message}
                      onChange={updateField('message')}
                      placeholder="Enjoy your detail."
                      className="h-24 w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-sm text-brand-black focus:border-brand-mclaren focus:outline-none"
                    />
                  </div>
                </div>

                {paymentError && (
                  <div className="mt-5 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {paymentError}
                  </div>
                )}

                <div className="mt-6">
                  <Button onClick={initiatePayment} disabled={!canProceed || isCreatingPayment} fullWidth icon>
                    {isCreatingPayment ? content.proceedingButtonLabel : content.proceedButtonLabel}
                  </Button>
                  <p className="mt-3 text-center text-xs text-gray-500">{content.paymentNote}</p>
                </div>
              </>
            )}

            {step === 'payment' && clientSecret && (
              <>
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="font-display text-3xl font-semibold uppercase text-brand-black">
                    {content.paymentTitle}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setStep('config')}
                    className="text-sm font-medium text-gray-500 transition-colors hover:text-brand-mclaren"
                  >
                    {content.backToConfigLabel}
                  </button>
                </div>
                <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
                  <CheckoutForm
                    amount={Math.round(effectiveAmount)}
                    recipientEmail={formData.recipientEmail}
                    senderName={formData.senderName}
                    message={formData.message}
                    onSuccess={() => setStep('success')}
                  />
                </Elements>
              </>
            )}

            {step === 'success' && (
              <div className="animate-fade-in py-10 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <Check className="h-8 w-8" />
                </div>
                <h2 className="mt-6 font-display text-3xl font-semibold uppercase text-brand-black">
                  {content.successTitle}
                </h2>
                <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-gray-600">
                  {content.successMessagePrefix} {formData.recipientEmail}.
                </p>
                <div className="mt-8">
                  <Button
                    onClick={() => {
                      setStep('config');
                      setClientSecret('');
                      setCustomEnabled(false);
                      setCustomAmount('');
                      setSelectedAmount(content.presetAmounts[0] || 100);
                      setFormData({ recipientEmail: '', senderName: '', message: '' });
                    }}
                  >
                    {content.resetButtonLabel}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default GiftCards;
