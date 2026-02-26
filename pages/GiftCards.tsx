import React, { useState, useEffect } from 'react';
import { Gift, Check, CreditCard, Loader2 } from 'lucide-react';
import Button from '../components/Button';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

// Initialize Stripe outside of component to avoid recreating it
// Replace with your actual publishable key
const stripePromise = loadStripe('pk_test_51O...placeholder'); 

const CheckoutForm: React.FC<{ 
  amount: number; 
  recipientEmail: string; 
  senderName: string; 
  message: string;
  onSuccess: () => void;
}> = ({ amount, recipientEmail, senderName, message, onSuccess }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [messageState, setMessageState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsLoading(true);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        // Return URL is required but we handle redirect manually or stay on page
        return_url: window.location.origin + '/gift-cards', 
      },
      redirect: 'if_required',
    });

    if (error) {
      setMessageState(error.message || 'An unexpected error occurred.');
      setIsLoading(false);
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      // Payment successful, now send the gift card
      try {
        await fetch('/api/send-gift-card', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipientEmail,
            senderName,
            message,
            amount,
            code: 'GC-' + Math.random().toString(36).substr(2, 9).toUpperCase() // Mock code generation
          }),
        });
        onSuccess();
      } catch (err) {
        setMessageState('Payment successful but failed to send email. Please contact support.');
      }
      setIsLoading(false);
    } else {
        setMessageState('Payment processing...');
        setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      {messageState && <div className="text-red-500 text-xs font-mono">{messageState}</div>}
      <Button 
        fullWidth 
        disabled={isLoading || !stripe || !elements} 
        className="mt-4 justify-center"
      >
        {isLoading ? <Loader2 className="animate-spin w-4 h-4" /> : `Pay $${amount}`}
      </Button>
    </form>
  );
};

const GiftCards: React.FC = () => {
  const [selectedAmount, setSelectedAmount] = useState(100);
  const [step, setStep] = useState<'config' | 'payment' | 'success'>('config');
  const [clientSecret, setClientSecret] = useState('');
  
  const [formData, setFormData] = useState({
    recipientEmail: '',
    senderName: '',
    message: ''
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.type === 'email' ? 'recipientEmail' : e.target.type === 'text' && e.target.tagName === 'INPUT' ? 'senderName' : 'message']: e.target.value });
  };
  
  // Specific handler for message textarea to avoid type issues
  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setFormData({ ...formData, message: e.target.value });
  };
  
  // Specific handler for inputs
  const handleGenericInputChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData({ ...formData, [field]: e.target.value });
  };

  const initiatePayment = async () => {
    if (!formData.recipientEmail) return; // Basic validation

    // Create PaymentIntent on server
    const res = await fetch('/api/create-payment-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: selectedAmount }),
    });
    const data = await res.json();
    setClientSecret(data.clientSecret);
    setStep('payment');
  };

  return (
    <div className="bg-brand-white min-h-screen">
      {/* Header */}
      <div className="py-24 border-b border-brand-black px-4">
         <div className="container mx-auto">
            <h1 className="text-[12vw] leading-none font-display font-bold uppercase">Gift Cards</h1>
            <p className="font-mono text-sm uppercase max-w-md mt-8">
               Digital currency for the automotive connoisseur.
            </p>
         </div>
      </div>

      <div className="container mx-auto max-w-6xl py-20 px-4">
        <div className="grid md:grid-cols-2 gap-12 border border-brand-black p-8 bg-brand-gray shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]">
          {/* Visual Side */}
          <div className="flex flex-col justify-between">
            <div className="relative aspect-[1.6/1] bg-brand-black p-8 flex flex-col justify-between text-white border border-brand-black overflow-hidden group">
               {/* Card Pattern */}
               <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-gray-700 via-black to-black"></div>
               
               <div className="relative z-10 flex justify-between items-start">
                  <span className="font-display font-bold text-3xl uppercase tracking-tighter">
                    <span className="text-brand-mclaren">SPA</span> FOR <span className="text-brand-mclaren">CAR</span>
                  </span>
                  <span className="font-mono font-bold text-2xl">${selectedAmount}</span>
               </div>
               
               <div className="relative z-10 text-right">
                  <p className="font-mono text-xs uppercase tracking-widest mb-1">Gift Voucher</p>
                  <p className="font-mono text-sm">**** **** **** 4293</p>
               </div>
            </div>
            
            <div className="mt-8">
              <h3 className="font-display font-bold text-xl uppercase mb-4">The Perfect Gift</h3>
              <ul className="space-y-3">
                {['Instant digital delivery', 'Valid for all services', 'Never expires', 'The feeling of a brand new car'].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 font-mono text-xs uppercase">
                    <Check className="w-4 h-4 text-brand-black" /> {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Form Side */}
          <div className="bg-brand-white border border-brand-black p-8">
            {step === 'config' && (
              <>
                <h2 className="font-display font-bold text-3xl uppercase mb-6">Configure</h2>
                <div className="space-y-6">
                  <div>
                    <label className="block font-mono text-xs uppercase font-bold mb-3">Select Amount</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[50, 100, 200, 300, 500].map((amount) => (
                        <button
                          key={amount}
                          onClick={() => setSelectedAmount(amount)}
                          className={`py-3 border font-mono text-xs font-bold transition-all ${
                            selectedAmount === amount
                              ? 'bg-brand-black text-white border-brand-black'
                              : 'bg-white text-brand-black border-brand-black hover:bg-gray-100'
                          }`}
                        >
                          ${amount}
                        </button>
                      ))}
                      <button className="py-3 border border-brand-black font-mono text-xs font-bold bg-white hover:bg-gray-100">
                        Custom
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                     <div>
                        <label className="block font-mono text-xs uppercase font-bold mb-2">Recipient Email</label>
                        <input 
                          type="email" 
                          className="w-full border border-brand-black p-3 font-mono text-sm focus:outline-none focus:bg-gray-50 rounded-none" 
                          placeholder="FRIEND@EXAMPLE.COM"
                          value={formData.recipientEmail}
                          onChange={handleGenericInputChange('recipientEmail')}
                        />
                     </div>
                     <div>
                        <label className="block font-mono text-xs uppercase font-bold mb-2">From</label>
                        <input 
                          type="text" 
                          className="w-full border border-brand-black p-3 font-mono text-sm focus:outline-none focus:bg-gray-50 rounded-none" 
                          placeholder="YOUR NAME"
                          value={formData.senderName}
                          onChange={handleGenericInputChange('senderName')}
                        />
                     </div>
                     <div>
                        <label className="block font-mono text-xs uppercase font-bold mb-2">Message</label>
                        <textarea 
                          className="w-full border border-brand-black p-3 font-mono text-sm focus:outline-none focus:bg-gray-50 h-24 rounded-none" 
                          placeholder="ENJOY THE SHINE!"
                          value={formData.message}
                          onChange={handleMessageChange}
                        ></textarea>
                     </div>
                  </div>

                  <Button fullWidth className="mt-4" icon onClick={initiatePayment}>
                    Proceed to Payment
                  </Button>
                  <p className="text-center font-mono text-[10px] uppercase text-gray-500 mt-4">Secure payment processed by Stripe.</p>
                </div>
              </>
            )}

            {step === 'payment' && clientSecret && (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-display font-bold text-3xl uppercase">Payment</h2>
                  <button onClick={() => setStep('config')} className="text-xs font-mono underline">Back</button>
                </div>
                <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
                  <CheckoutForm 
                    amount={selectedAmount}
                    recipientEmail={formData.recipientEmail}
                    senderName={formData.senderName}
                    message={formData.message}
                    onSuccess={() => setStep('success')}
                  />
                </Elements>
              </>
            )}

            {step === 'success' && (
              <div className="text-center py-12 animate-fade-in">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="font-display font-bold text-3xl uppercase mb-4">Purchase Complete</h2>
                <p className="font-mono text-sm text-gray-600 mb-8">
                  Your gift card has been sent to {formData.recipientEmail}.
                </p>
                <Button onClick={() => {
                  setStep('config');
                  setFormData({ recipientEmail: '', senderName: '', message: '' });
                }}>
                  Send Another
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GiftCards;