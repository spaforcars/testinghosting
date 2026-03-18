import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Services from './pages/Services';
import Booking from './pages/Booking';
import BookingManage from './pages/BookingManage';
import GiftCards from './pages/GiftCards';
import Fleet from './pages/Fleet';
import Gallery from './pages/Gallery';
import About from './pages/About';
import FAQ from './pages/FAQ';
import Pricing from './pages/Pricing';
import Contact from './pages/Contact';
import AutoRepair from './pages/AutoRepair';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/AdminDashboard';

const App: React.FC = () => {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/services" element={<Services />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/booking" element={<Booking />} />
          <Route path="/booking/manage/:reference" element={<BookingManage />} />
          <Route path="/gift-cards" element={<GiftCards />} />
          <Route path="/fleet" element={<Fleet />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/auto-repair" element={<AutoRepair />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/admin" element={<AdminDashboard />} />
        </Routes>
      </Layout>
    </Router>
  );
};

export default App;
