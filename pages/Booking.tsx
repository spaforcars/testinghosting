import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, CheckCircle2 } from 'lucide-react';
import Button from '../components/Button';

const Booking: React.FC = () => {
  const location = useLocation();
  const [step, setStep] = useState(1);
  const [selectedService, setSelectedService] = useState<{name: string, price: string, duration: string} | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  
  // Mock Calendar State
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const services = [
    { id: '1', name: 'The Refresh', price: '$95', duration: '1.5h' },
    { id: '2', name: 'Signature Detail', price: '$295', duration: '4h' },
    { id: '3', name: 'Ceramic Coating', price: '$800', duration: '1 Day' },
    { id: '4', name: 'PPF Front', price: '$1,800', duration: '2 Days' }
  ];

  // Pre-select service from URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const serviceId = params.get('service');
    if (serviceId) {
      const found = services.find(s => s.id === serviceId);
      if (found) {
        setSelectedService(found);
      }
    }
  }, [location]);

  // Calendar Logic
  const daysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const generateDays = () => {
    const days = [];
    const totalDays = daysInMonth(currentMonth);
    const startDay = firstDayOfMonth(currentMonth);

    // Empty cells for offset
    for (let i = 0; i < startDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-12 border-r border-b border-brand-black bg-brand-gray/20"></div>);
    }

    // Days
    for (let i = 1; i <= totalDays; i++) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i);
      const isSelected = selectedDate?.toDateString() === date.toDateString();
      const isToday = new Date().toDateString() === date.toDateString();
      
      days.push(
        <button
          key={i}
          onClick={() => { setSelectedDate(date); setSelectedTime(null); }}
          className={`h-12 border-r border-b border-brand-black font-mono text-xs transition-colors hover:bg-brand-black hover:text-white relative
            ${isSelected ? 'bg-brand-black text-white' : 'bg-brand-white'}
            ${isToday ? 'font-bold' : ''}
          `}
        >
          {i}
          {isToday && <span className="absolute top-1 right-1 w-1 h-1 bg-brand-accent rounded-full"></span>}
        </button>
      );
    }
    return days;
  };

  const timeSlots = [
    '09:00 AM', '10:00 AM', '11:00 AM', '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM'
  ];

  const formatMonth = (date: Date) => {
    return date.toLocaleString('default', { month: 'long', year: 'numeric' }).toUpperCase();
  };

  return (
    <div className="min-h-screen bg-brand-gray">
      <div className="grid grid-cols-1 lg:grid-cols-3 min-h-screen">
        
        {/* Left Panel: Summary (Sticky) */}
        <div className="hidden lg:flex flex-col border-r border-brand-black bg-brand-white p-12 justify-between sticky top-[65px] h-[calc(100vh-65px)]">
           <div>
              <h1 className="font-display font-bold text-6xl uppercase leading-none mb-6">Booking<br/>Engine</h1>
              <p className="font-mono text-sm uppercase leading-relaxed text-gray-500 mb-8">
                 Secure your appointment at our luxury studio.
              </p>
              
              <div className="space-y-6">
                 <div className={`transition-opacity duration-300 ${step >= 1 ? 'opacity-100' : 'opacity-30'}`}>
                    <h3 className="font-display font-bold text-xl uppercase mb-2 flex items-center gap-2">
                       {step > 1 && <CheckCircle2 className="w-4 h-4 text-brand-black"/>} 01. Service
                    </h3>
                    <div className="font-mono text-xs border-l-2 border-brand-black pl-4 py-1">
                       {selectedService ? (
                          <>
                             <p className="font-bold">{selectedService.name}</p>
                             <p className="text-gray-500">{selectedService.duration} • {selectedService.price}</p>
                          </>
                       ) : (
                          <p className="text-gray-400 italic">No service selected</p>
                       )}
                    </div>
                 </div>

                 <div className={`transition-opacity duration-300 ${step >= 2 ? 'opacity-100' : 'opacity-30'}`}>
                    <h3 className="font-display font-bold text-xl uppercase mb-2 flex items-center gap-2">
                       {step > 2 && <CheckCircle2 className="w-4 h-4 text-brand-black"/>} 02. Date & Time
                    </h3>
                    <div className="font-mono text-xs border-l-2 border-brand-black pl-4 py-1">
                       {selectedDate ? (
                          <>
                             <p className="font-bold">{selectedDate.toLocaleDateString()}</p>
                             <p className="text-gray-500">{selectedTime || 'Select a time'}</p>
                          </>
                       ) : (
                          <p className="text-gray-400 italic">Pending selection</p>
                       )}
                    </div>
                 </div>

                 <div className={`transition-opacity duration-300 ${step >= 3 ? 'opacity-100' : 'opacity-30'}`}>
                    <h3 className="font-display font-bold text-xl uppercase mb-2">03. Details</h3>
                    <div className="font-mono text-xs border-l-2 border-brand-black pl-4 py-1">
                       <p className="text-gray-400 italic">Contact information</p>
                    </div>
                 </div>
              </div>
           </div>

           <div className="border-t border-brand-black pt-6">
              <div className="flex justify-between font-display font-bold text-2xl uppercase">
                 <span>Total:</span>
                 <span>{selectedService ? selectedService.price : '$0.00'}</span>
              </div>
           </div>
        </div>

        {/* Right Panel: Interactive Form */}
        <div className="col-span-1 lg:col-span-2 bg-brand-gray p-4 md:p-12 lg:p-16 overflow-y-auto">
          <div className="bg-brand-white border border-brand-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] max-w-2xl mx-auto">
             
             {/* Step 1: Services */}
             {step === 1 && (
               <div className="p-8 md:p-12 animate-fade-in">
                  <div className="flex justify-between items-end mb-8 border-b border-brand-black pb-4">
                     <h2 className="font-display text-3xl uppercase font-bold">Select Service</h2>
                     <span className="font-mono text-xs uppercase bg-brand-black text-white px-2 py-1">Step 1/3</span>
                  </div>
                  
                  <div className="space-y-4">
                    {services.map((pkg) => (
                      <label 
                        key={pkg.id} 
                        className={`flex items-center justify-between p-6 border cursor-pointer transition-all hover:translate-x-2
                           ${selectedService?.id === pkg.id 
                              ? 'border-brand-black bg-brand-black text-white shadow-[4px_4px_0px_0px_#f5f5f5]' 
                              : 'border-brand-black bg-white hover:bg-gray-50'}
                        `}
                      >
                         <div className="flex items-center gap-6">
                            <div className={`w-6 h-6 border flex items-center justify-center transition-colors
                               ${selectedService?.id === pkg.id ? 'border-white bg-white' : 'border-brand-black'}
                            `}>
                               {selectedService?.id === pkg.id && <div className="w-3 h-3 bg-brand-black"></div>}
                            </div>
                            <div>
                               <span className="font-bold uppercase font-display text-lg tracking-wide block">{pkg.name}</span>
                               <span className={`text-xs font-mono uppercase ${selectedService?.id === pkg.id ? 'text-gray-300' : 'text-gray-500'}`}>
                                  Duration: {pkg.duration}
                               </span>
                            </div>
                         </div>
                         <span className="font-mono text-lg font-bold">{pkg.price}</span>
                         <input 
                           type="radio" 
                           name="service" 
                           className="hidden" 
                           checked={selectedService?.id === pkg.id}
                           onChange={() => setSelectedService(pkg)}
                         />
                      </label>
                    ))}
                  </div>
                  
                  <div className="pt-8 flex justify-end">
                     <Button 
                        onClick={() => setStep(2)} 
                        disabled={!selectedService}
                        className={!selectedService ? 'opacity-50' : ''}
                        icon
                     >
                        Availability
                     </Button>
                  </div>
               </div>
             )}

             {/* Step 2: Calendar & Time */}
             {step === 2 && (
               <div className="p-8 md:p-12 animate-fade-in">
                  <div className="flex justify-between items-end mb-8 border-b border-brand-black pb-4">
                     <h2 className="font-display text-3xl uppercase font-bold">Date & Time</h2>
                     <span className="font-mono text-xs uppercase bg-brand-black text-white px-2 py-1">Step 2/3</span>
                  </div>
                  
                  <div className="flex flex-col md:flex-row gap-8">
                     {/* Calendar Widget */}
                     <div className="flex-1">
                        <div className="flex justify-between items-center mb-4 bg-brand-black text-white p-2">
                           <button onClick={handlePrevMonth} className="hover:text-gray-300"><ChevronLeft/></button>
                           <span className="font-mono text-sm font-bold tracking-widest">{formatMonth(currentMonth)}</span>
                           <button onClick={handleNextMonth} className="hover:text-gray-300"><ChevronRight/></button>
                        </div>
                        
                        <div className="border-t border-l border-brand-black grid grid-cols-7 bg-white">
                           {['S','M','T','W','T','F','S'].map(d => (
                              <div key={d} className="h-8 flex items-center justify-center border-r border-b border-brand-black font-mono text-xs font-bold bg-gray-100">
                                 {d}
                              </div>
                           ))}
                           {generateDays()}
                        </div>
                     </div>

                     {/* Time Slots */}
                     <div className="w-full md:w-48">
                        <h3 className="font-mono text-xs uppercase font-bold mb-4 flex items-center gap-2">
                           <Clock className="w-4 h-4"/> Available Slots
                        </h3>
                        {selectedDate ? (
                           <div className="grid grid-cols-2 md:grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                              {timeSlots.map(time => (
                                 <button
                                    key={time}
                                    onClick={() => setSelectedTime(time)}
                                    className={`py-3 px-4 text-xs font-mono border border-brand-black transition-all hover:translate-x-1 text-center
                                       ${selectedTime === time 
                                          ? 'bg-brand-black text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)]' 
                                          : 'bg-white hover:bg-gray-50'}
                                    `}
                                 >
                                    {time}
                                 </button>
                              ))}
                           </div>
                        ) : (
                           <div className="h-full flex items-center justify-center border border-brand-black border-dashed bg-gray-50 p-4 text-center">
                              <p className="font-mono text-xs text-gray-400">Select a date to view available times.</p>
                           </div>
                        )}
                     </div>
                  </div>

                  <div className="pt-12 flex justify-between">
                     <button onClick={() => setStep(1)} className="font-mono text-xs uppercase underline hover:text-gray-600 flex items-center gap-2">
                        <ArrowLeft className="w-3 h-3"/> Back
                     </button>
                     <Button 
                        onClick={() => setStep(3)}
                        disabled={!selectedDate || !selectedTime}
                        className={(!selectedDate || !selectedTime) ? 'opacity-50' : ''}
                     >
                        Next Step
                     </Button>
                  </div>
               </div>
             )}

             {/* Step 3: Confirmation */}
             {step === 3 && (
               <div className="p-8 md:p-12 animate-fade-in">
                  <div className="flex justify-between items-end mb-8 border-b border-brand-black pb-4">
                     <h2 className="font-display text-3xl uppercase font-bold">Finalize</h2>
                     <span className="font-mono text-xs uppercase bg-brand-black text-white px-2 py-1">Step 3/3</span>
                  </div>
                  
                  <div className="space-y-6">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                           <label className="font-mono text-xs uppercase font-bold">Full Name</label>
                           <input type="text" className="w-full border border-brand-black p-4 font-mono text-sm focus:outline-none focus:bg-gray-50 bg-white rounded-none" placeholder="JOHN DOE" />
                        </div>
                        <div className="space-y-2">
                           <label className="font-mono text-xs uppercase font-bold">Email Address</label>
                           <input type="email" className="w-full border border-brand-black p-4 font-mono text-sm focus:outline-none focus:bg-gray-50 bg-white rounded-none" placeholder="JOHN@EXAMPLE.COM" />
                        </div>
                     </div>
                     
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                           <label className="font-mono text-xs uppercase font-bold">Phone Number</label>
                           <input type="tel" className="w-full border border-brand-black p-4 font-mono text-sm focus:outline-none focus:bg-gray-50 bg-white rounded-none" placeholder="+1 (555) 000-0000" />
                        </div>
                        <div className="space-y-2">
                           <label className="font-mono text-xs uppercase font-bold">Vehicle Details</label>
                           <input type="text" className="w-full border border-brand-black p-4 font-mono text-sm focus:outline-none focus:bg-gray-50 bg-white rounded-none" placeholder="YEAR MAKE MODEL" />
                        </div>
                     </div>

                     <div className="space-y-2">
                        <label className="font-mono text-xs uppercase font-bold">Special Requests</label>
                        <textarea className="w-full border border-brand-black p-4 font-mono text-sm focus:outline-none focus:bg-gray-50 bg-white rounded-none h-24" placeholder="ANY SPECIFIC CONCERNS..."></textarea>
                     </div>
                  </div>

                  <div className="pt-12 flex justify-between items-center">
                     <button onClick={() => setStep(2)} className="font-mono text-xs uppercase underline hover:text-gray-600 flex items-center gap-2">
                        <ArrowLeft className="w-3 h-3"/> Back
                     </button>
                     <Button>Confirm Booking</Button>
                  </div>
               </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Booking;