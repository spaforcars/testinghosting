import React, { useState } from 'react';
import Button from '../components/Button';
import { MapPin, Phone, Mail, Clock } from 'lucide-react';

const Contact: React.FC = () => {
  const [formStatus, setFormStatus] = useState<'idle' | 'submitting' | 'success'>('idle');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormStatus('submitting');
    setTimeout(() => {
      setFormStatus('success');
    }, 1500);
  };

  return (
    <div className="bg-brand-white min-h-screen flex flex-col">
      <div className="py-24 border-b border-brand-black px-4 text-center">
         <h1 className="text-[10vw] md:text-[8vw] leading-none font-display font-bold uppercase mb-4">Contact</h1>
         <p className="font-mono text-sm uppercase max-w-md mx-auto text-gray-500">
           Get in touch with our concierge team.
         </p>
      </div>

      <div className="flex-grow grid grid-cols-1 lg:grid-cols-2">
        <div className="p-8 md:p-16 border-b lg:border-b-0 lg:border-r border-brand-black">
           <h2 className="font-display font-bold text-3xl uppercase mb-8">Send a Message</h2>
           
           {formStatus === 'success' ? (
             <div className="bg-green-50 border border-green-200 p-8 text-center animate-fade-in">
               <h3 className="font-display font-bold text-xl uppercase mb-2 text-green-800">Message Sent</h3>
               <p className="font-mono text-xs text-green-600 mb-6">Thank you. We will respond within 24 hours.</p>
               <Button onClick={() => setFormStatus('idle')}>Send Another</Button>
             </div>
           ) : (
             <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
               <div className="space-y-2">
                 <label className="font-mono text-xs uppercase font-bold">Full Name</label>
                 <input required type="text" className="w-full border border-brand-black p-4 font-mono text-sm focus:outline-none focus:bg-gray-50 rounded-none" placeholder="JOHN DOE" />
               </div>
               <div className="space-y-2">
                 <label className="font-mono text-xs uppercase font-bold">Email Address</label>
                 <input required type="email" className="w-full border border-brand-black p-4 font-mono text-sm focus:outline-none focus:bg-gray-50 rounded-none" placeholder="JOHN@EXAMPLE.COM" />
               </div>
               <div className="space-y-2">
                 <label className="font-mono text-xs uppercase font-bold">Subject</label>
                 <select className="w-full border border-brand-black p-4 font-mono text-sm focus:outline-none focus:bg-gray-50 rounded-none bg-white">
                   <option>General Inquiry</option>
                   <option>Booking Request</option>
                   <option>Partnership</option>
                   <option>Feedback</option>
                 </select>
               </div>
               <div className="space-y-2">
                 <label className="font-mono text-xs uppercase font-bold">Message</label>
                 <textarea required className="w-full border border-brand-black p-4 font-mono text-sm focus:outline-none focus:bg-gray-50 rounded-none h-32" placeholder="HOW CAN WE HELP?"></textarea>
               </div>
               <Button type="submit" disabled={formStatus === 'submitting'} className="w-full justify-center">
                 {formStatus === 'submitting' ? 'Sending...' : 'Send Message'}
               </Button>
             </form>
           )}
        </div>

        <div className="flex flex-col">
           <div className="grid grid-cols-1 md:grid-cols-2 border-b border-brand-black">
              <div className="p-8 border-b md:border-b-0 md:border-r border-brand-black">
                 <div className="flex items-center gap-2 mb-4">
                   <MapPin className="w-5 h-5" />
                   <h3 className="font-display font-bold text-xl uppercase">Visit Us</h3>
                 </div>
                 <p className="font-mono text-xs leading-relaxed text-gray-600">
                   123 Gloss Avenue<br/>
                   Luxury District<br/>
                   Beverly Hills, CA 90210
                 </p>
              </div>
              <div className="p-8">
                 <div className="flex items-center gap-2 mb-4">
                   <Clock className="w-5 h-5" />
                   <h3 className="font-display font-bold text-xl uppercase">Hours</h3>
                 </div>
                 <p className="font-mono text-xs leading-relaxed text-gray-600">
                   Mon - Fri: 8am - 6pm<br/>
                   Sat: 9am - 5pm<br/>
                   Sun: 10am - 4pm
                 </p>
              </div>
           </div>
           
           <div className="flex-grow min-h-[400px] bg-gray-100 relative">
             <iframe 
               src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3305.715220363387!2d-118.4003565847849!3d34.07623998059863!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x80c2bc04d6d147ab%3A0xd6c7c5274d810af!2sBeverly%20Hills%2C%20CA%2090210!5e0!3m2!1sen!2sus!4v1645564756832!5m2!1sen!2sus" 
               width="100%" 
               height="100%" 
               style={{border:0}} 
               allowFullScreen 
               loading="lazy"
               className="grayscale contrast-125"
             ></iframe>
             
             <div className="absolute bottom-8 left-8 bg-white border border-brand-black p-4 shadow-lg max-w-xs hidden md:block">
               <h4 className="font-display font-bold text-lg uppercase mb-1">Spa for Car</h4>
               <p className="font-mono text-[10px] text-gray-500 uppercase">Entrance on Gloss Ave.</p>
             </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Contact;
