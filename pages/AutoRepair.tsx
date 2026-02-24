import React, { useState } from 'react';
import Button from '../components/Button';
import { Wrench } from 'lucide-react';

const AutoRepair: React.FC = () => {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubscribed(true);
      setEmail('');
    }
  };

  return (
    <div className="min-h-screen bg-brand-black text-white flex flex-col items-center justify-center relative overflow-hidden px-4">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
         <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
      </div>

      <div className="z-10 text-center max-w-2xl mx-auto">
        <div className="mb-8 flex justify-center">
          <div className="w-20 h-20 border-2 border-white rounded-full flex items-center justify-center animate-pulse">
            <Wrench className="w-10 h-10" />
          </div>
        </div>
        
        <h1 className="font-display font-bold text-6xl md:text-8xl uppercase mb-4 tracking-tighter">
          Coming<br/><span className="text-outline-white">Soon</span>
        </h1>
        
        <p className="font-mono text-sm md:text-base uppercase tracking-widest mb-12 text-gray-400">
          Spa for Cars Auto Repair Division.<br/>
          Precision mechanics meeting luxury care.
        </p>

        {subscribed ? (
          <div className="bg-white/10 border border-white/20 p-8 animate-fade-in">
            <p className="font-display font-bold text-xl uppercase">You're on the list.</p>
            <p className="font-mono text-xs mt-2 text-gray-400">We'll notify you when the garage opens.</p>
          </div>
        ) : (
          <form onSubmit={handleSubscribe} className="flex flex-col md:flex-row gap-4 max-w-md mx-auto">
            <input 
              type="email" 
              placeholder="ENTER EMAIL FOR UPDATES" 
              className="flex-grow bg-transparent border border-white p-4 font-mono text-xs text-white placeholder:text-gray-600 focus:outline-none focus:bg-white/5 uppercase"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Button variant="white" type="submit">Notify Me</Button>
          </form>
        )}
      </div>

      <div className="absolute bottom-8 left-0 w-full text-center">
        <p className="font-mono text-[10px] uppercase text-gray-600">Expected Launch: Q4 2025</p>
      </div>
    </div>
  );
};

export default AutoRepair;
