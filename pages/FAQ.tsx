import React, { useState } from 'react';
import { Plus, Minus } from 'lucide-react';
import { FaqItem } from '../types';

const FAQ: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs: FaqItem[] = [
    {
      question: "How long does a full detail take?",
      answer: "A standard full detail typically takes 3-5 hours depending on the vehicle size and condition. Ceramic coating packages may require the vehicle to stay with us for 24-48 hours to allow for proper curing."
    },
    {
      question: "Do you offer mobile detailing?",
      answer: "Yes, for fleet clients and select premium packages, we offer mobile service. However, for paint correction and ceramic coatings, we recommend visiting our climate-controlled studio for the best results."
    },
    {
      question: "What is the difference between wax and ceramic coating?",
      answer: "Wax sits on top of the paint and lasts 1-3 months. Ceramic coating bonds chemically to the paint, providing a harder, more durable layer of protection that lasts years, resists chemicals, and offers superior gloss."
    },
    {
      question: "How should I maintain my car after a coating?",
      answer: "Avoid automatic car washes with brushes! We recommend hand washing using the two-bucket method and pH-neutral soaps. We provide a full care guide with every coating service."
    },
    {
      question: "Is there a cancellation fee?",
      answer: "We ask for 24 hours notice for cancellations. Cancellations made within 24 hours of the appointment may be subject to a $50 fee."
    }
  ];

  return (
    <div className="bg-brand-white min-h-screen">
      <div className="py-24 border-b border-brand-black px-4">
        <div className="container mx-auto max-w-4xl text-center">
           <h1 className="text-[10vw] leading-none font-display font-bold uppercase mb-4">Questions?</h1>
           <p className="font-mono text-sm uppercase">Everything you need to know about our process.</p>
        </div>
      </div>
      
      <div className="container mx-auto max-w-3xl py-24 px-4">
        <div className="border-t border-brand-black">
          {faqs.map((faq, index) => (
            <div key={index} className="border-b border-brand-black">
              <button
                className="w-full py-8 text-left flex justify-between items-center focus:outline-none group hover:bg-gray-50 transition-colors px-2"
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
              >
                <span className="font-display font-bold text-xl uppercase">{faq.question}</span>
                {openIndex === index ? <Minus className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
              </button>
              
              <div 
                className={`overflow-hidden transition-all duration-300 ${
                  openIndex === index ? 'max-h-40 pb-8' : 'max-h-0'
                }`}
              >
                <div className="font-mono text-sm text-gray-600 px-2 leading-relaxed">
                  {faq.answer}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FAQ;