export interface Service {
  id: string;
  title: string;
  description: string;
  category: 'Detailing' | 'Protection' | 'Restoration';
  price: string;
  duration: string;
  features: string[];
  image: string;
}

export interface Review {
  id: string;
  name: string;
  role: string; // e.g., "Car Owner" or "Fleet Manager"
  vehicle: string;
  rating: number;
  text: string;
}

export interface Package {
  id: string;
  name: string;
  tagline: string;
  price: string;
  features: string[];
  duration: string;
  isPopular?: boolean;
}

export interface FaqItem {
  question: string;
  answer: string;
}