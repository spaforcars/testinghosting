import type {
  AboutPageContent,
  AutoRepairPageContent,
  ContactPageContent,
  FaqPageContent,
  FleetPageContent,
  GalleryPageContent,
  GiftCardsPageContent,
  HomePageContent,
  NavigationContent,
  PricingPageContent,
  SiteSettingsContent,
  ServicesPageContent,
} from '../types/cms';

export const defaultHomePageContent: HomePageContent = {
  heroTitle: "Ontario's Top",
  heroAccent: 'Ceramic Coating',
  heroSubtitle: "Preserve Your Paint | Enhance Your Car's Value | Drive with Confidence",
  heroImage: '/client-images/hero-section-pic.PNG',
  heroButtonLabel: 'Get Started',
  heroButtonPath: '/booking',
  whyTitle: 'Why Choose Us?',
  whyBody:
    'Spa for Cars specializes in high-quality car detailing that restores, protects, and enhances your vehicle. We are your one-stop shop for deep interior cleaning, exterior polishing, long-lasting ceramic coating, PPF, window tinting, and much more!',
  whyFeatures: [
    {
      icon: 'shield',
      title: 'Ceramic Coating',
      description: 'Industry-leading 9H ceramic protection that lasts years, not months.',
    },
    {
      icon: 'droplets',
      title: 'Paint Correction',
      description: 'Multi-stage paint correction to eliminate swirls, scratches and oxidation.',
    },
    {
      icon: 'car',
      title: 'Full Detailing',
      description: 'Comprehensive interior and exterior detailing for a showroom finish.',
    },
    {
      icon: 'sparkles',
      title: 'Window Tinting',
      description: 'Premium window tinting for UV protection, privacy, and style.',
    },
  ],
  showcaseBadge: 'Our Services',
  showcaseTitle: 'What We Offer',
  showcaseViewAllLabel: 'View All',
  showcaseViewAllPath: '/services',
  showcaseServices: [],
  testimonialQuote:
    '"My Tesla has never looked this good. The ceramic coating is a game changer. Pure art."',
  testimonialAuthor: '- Alex Johnson, Tesla Model S Owner',
  galleryBadge: 'Our Work',
  galleryTitle: 'Recent Projects',
  galleryViewAllLabel: 'View Full Gallery',
  galleryViewAllPath: '/gallery',
  galleryImages: [
    '/client-images/IMG_2414.PNG',
    '/client-images/IMG_2449.PNG',
    '/client-images/IMG_2462.PNG',
  ],
  ctaTitle: 'Ready to Transform Your Vehicle?',
  ctaBody: 'Book your appointment today and experience the Spa for Cars difference.',
  ctaButtonLabel: 'Book Appointment',
  ctaButtonPath: '/booking',
  promoPlacements: [],
};

export const defaultServicesPageContent: ServicesPageContent = {
  badge: 'Service Menu',
  title: 'Professional Detailing Packages Built For Real Results',
  subtitle:
    'Every package is built with premium products, disciplined process, and clear deliverables so you know exactly what your vehicle receives.',
  services: [
    {
      id: '1',
      title: 'The Refresh',
      description: 'A premium maintenance wash and light interior detail. Perfect for regular upkeep.',
      category: 'Detailing',
      price: '$95+',
      duration: '1.5 Hours',
      image: '/client-images/IMG_2414.PNG',
      features: ['Foam Hand Wash', 'Wheel Cleaning', 'Vacuum & Wipe Down', 'Tire Dressing', 'Spray Wax'],
      idealFor: 'Weekly or bi-weekly maintenance on daily-driven vehicles.',
      process: 'Safe foam pre-wash, contact wash, wheel/tire cleaning, interior vacuum, and final gloss finish.',
      notes: 'Best kept on a 2-4 week schedule for a consistently clean car.',
    },
    {
      id: '2',
      title: 'Signature Detail',
      description: 'Complete interior deep clean and exterior gloss enhancement for a near-showroom finish.',
      category: 'Detailing',
      price: '$295+',
      duration: '4 Hours',
      image: '/client-images/IMG_2461.PNG',
      features: [
        'Everything in Refresh',
        'Clay Bar Treatment',
        'Machine Polish',
        'Leather Conditioning',
        'Steam Clean',
        '6-Month Sealant',
      ],
      idealFor: 'Vehicles that need a seasonal reset or pre-sale refresh.',
      process: 'Deep interior steam treatment, decontamination wash, paint gloss enhancement, and protective sealant.',
      notes: 'Recommended every 4-6 months depending on usage and storage conditions.',
    },
    {
      id: '3',
      title: 'Ceramic Coating',
      description: 'Long-lasting paint protection that delivers deep gloss, easier washing, and hydrophobic defense.',
      category: 'Protection',
      price: '$800+',
      duration: '1 Day',
      image: '/client-images/IMG_2449.PNG',
      features: ['3-Year Warranty', 'Paint Correction', 'Extreme Hydrophobicity', 'UV Protection', 'Self-Cleaning'],
      idealFor: 'Owners looking for long-term paint protection and easier maintenance.',
      process: 'Multi-stage prep and correction, panel wipe-down, precision coating installation, and cure inspection.',
      notes: 'Follow-up maintenance wash is recommended every 4-6 weeks.',
    },
    {
      id: '4',
      title: 'PPF Front Package',
      description: 'Invisible physical protection against rock chips and road debris for high-impact front surfaces.',
      category: 'Protection',
      price: '$1,800+',
      duration: '2 Days',
      image: '/client-images/IMG_2421_after.PNG',
      features: ['10-Year Warranty', 'Self-Healing Film', 'Covers Bumper/Hood', 'Invisible Edges', 'Stain Resistant'],
      idealFor: 'New vehicles, highway drivers, and performance cars prone to stone chips.',
      process: 'Precision template prep, edge wrapping, contaminant control, and final post-install inspection.',
      notes: 'Pairs best with ceramic coating for full exterior protection.',
    },
  ],
};

export const defaultFleetPageContent: FleetPageContent = {
  badge: 'Commercial Programs',
  title: 'Premium Detailing for Private Owners & Commercial Fleets',
  subtitle:
    'We deliver consistent turnaround, clean reporting, and scalable service plans for businesses that need vehicle presentation standards maintained.',
  dealershipsTitle: 'Dealerships',
  dealershipsItems: [
    'Pre-delivery inspection detailing',
    'Lot maintenance wash scheduling',
    'Showroom finish enhancement',
    'Priority turnaround windows',
  ],
  fleetsTitle: 'Corporate Fleets',
  fleetsItems: [
    'Monthly or bi-weekly service plans',
    'Consolidated invoicing',
    'On-site and studio service options',
    'Executive vehicle care tiers',
  ],
  proposalTitle: 'Request Proposal',
  proposalSubtitle:
    'Share your monthly volume and service expectations. We will provide a tailored plan and pricing recommendation.',
};

export const defaultFaqPageContent: FaqPageContent = {
  items: [
    {
      question: 'How long does a full detail take?',
      answer:
        'A standard full detail typically takes 3-5 hours depending on vehicle size and condition. Ceramic coating packages may require 24-48 hours for proper prep and curing.',
    },
    {
      question: 'Do you offer mobile detailing?',
      answer:
        'Yes. We offer mobile service for fleet clients and selected premium packages. Paint correction and ceramic coatings are best completed in our controlled studio environment.',
    },
    {
      question: 'What is the difference between wax and ceramic coating?',
      answer:
        'Wax sits on top of the paint and usually lasts 1-3 months. Ceramic coating bonds to the surface and provides longer protection, stronger chemical resistance, and easier maintenance.',
    },
    {
      question: 'How should I maintain my car after a coating?',
      answer:
        'Avoid brush-based automatic washes. Use pH-neutral soap and proper hand-wash technique. We provide a full aftercare guide with every coating package.',
    },
    {
      question: 'Is there a cancellation fee?',
      answer:
        'We request at least 24 hours notice. Cancellations within 24 hours may be subject to a $50 fee.',
    },
  ],
};

export const defaultContactPageContent: ContactPageContent = {
  title: 'Talk To Our Team',
  subtitle: 'Send us your request and we will get back with recommendations, pricing, and next steps.',
  address: 'Aurora, Ontario\nGreater Toronto Area',
  mapEmbedUrl: 'https://www.google.com/maps?q=Aurora%2C%20Ontario&output=embed',
};

export const defaultAboutPageContent: AboutPageContent = {
  badge: 'Our Story',
  title: 'More Than Just A Wash',
  subtitle:
    'Spa for Cars was founded to give every vehicle the same level of detail and care usually reserved for showroom exotics.',
  image: '/client-images/IMG_2417.PNG',
  imageBadge: 'Est. 2018',
  evolutionTitle: 'The Evolution',
  evolutionBody:
    'Formerly known as Quick Shine Auto, we grew into a process-driven studio focused on lasting protection, not quick cosmetics. The name Spa for Cars reflects the same careful treatment and restoration mindset we apply to every vehicle.',
  valueCards: [
    {
      icon: 'award',
      title: 'Certified Pros',
      description: 'IDA-certified detailers with disciplined prep and finish standards.',
    },
    {
      icon: 'heart',
      title: 'Passion Driven',
      description: 'We treat daily drivers and high-performance cars with the same care.',
    },
    {
      icon: 'users',
      title: 'Client First',
      description:
        'Transparent recommendations, realistic timelines, and clear communication from drop-off to handover.',
    },
  ],
};

export const defaultGalleryPageContent: GalleryPageContent = {
  badge: 'Real Results',
  title: 'Before And After Transformations',
  subtitle: 'Drag each slider to compare real customer vehicles before and after service.',
  transformations: [
    {
      label: 'Paint Correction',
      beforeImage: '/client-images/IMG_2414.PNG',
      afterImage: '/client-images/IMG_2415.PNG',
    },
    {
      label: 'Interior Restoration',
      beforeImage: '/client-images/IMG_2460_before.PNG',
      afterImage: '/client-images/IMG_2460_after.PNG',
    },
    {
      label: 'Steering Restoration',
      beforeImage: '/client-images/IMG_2439_before.PNG',
      afterImage: '/client-images/IMG_2439_after.PNG',
    },
    {
      label: 'Leather Seat Restoration',
      beforeImage: '/client-images/IMG_2445_before.PNG',
      afterImage: '/client-images/IMG_2445_after.PNG',
    },
    {
      label: 'Trim Refinement',
      beforeImage: '/client-images/IMG_2421_before.PNG',
      afterImage: '/client-images/IMG_2421_after.PNG',
    },
    {
      label: 'Panel Correction',
      beforeImage: '/client-images/IMG_2418_before.PNG',
      afterImage: '/client-images/IMG_2418_after.PNG',
    },
  ],
};

export const defaultAutoRepairPageContent: AutoRepairPageContent = {
  badge: 'New Service Division',
  title: 'Auto Repair Coming Soon',
  subtitle:
    'We are building a dedicated repair program to pair mechanical reliability with the same premium detailing standards.',
  inputPlaceholder: 'Enter your email for updates',
  submitButtonLabel: 'Notify Me',
  submittingButtonLabel: 'Submitting...',
  successTitle: "You're on the list",
  successMessage: "We'll notify you as soon as bookings open.",
};

export const defaultGiftCardsPageContent: GiftCardsPageContent = {
  badge: 'Gift Cards',
  title: 'Send Premium Vehicle Care As A Gift',
  subtitle: 'Digital gift cards are delivered instantly and can be used for any Spa for Cars service.',
  cardBrand: 'Spa for Cars',
  cardTitle: 'Gift Card',
  cardTagline: 'Valid on all detailing and protection services',
  benefits: [
    'Instant digital delivery by email',
    'No expiry date',
    'Redeemable across all services',
    'Great for enthusiasts and new car owners',
  ],
  configureTitle: 'Configure Gift Card',
  presetAmounts: [50, 100, 200, 300, 500],
  minCustomAmount: 25,
  recipientEmailLabel: 'Recipient Email',
  senderNameLabel: 'From',
  messageLabel: 'Message',
  proceedButtonLabel: 'Proceed To Payment',
  proceedingButtonLabel: 'Preparing Payment...',
  paymentTitle: 'Secure Payment',
  backToConfigLabel: 'Back',
  paymentNote: 'Secure checkout powered by Stripe.',
  successTitle: 'Purchase Complete',
  successMessagePrefix: 'Your gift card has been sent to',
  resetButtonLabel: 'Send Another Gift Card',
};

export const defaultPricingPageContent: PricingPageContent = {
  badge: 'Transparent Pricing',
  title: 'Premium Care Without Hidden Fees',
  subtitle:
    'Choose a package based on your vehicle condition and finish expectations. We can always tailor from here.',
  mostPopularBadge: 'Most Popular',
  selectPlanLabel: 'Select Plan',
  customQuoteTitle: 'Need A Custom Scope?',
  customQuoteBody:
    'For fleet contracts, restoration projects, or unique vehicles, we can build a custom plan around your needs.',
  customQuoteButtonLabel: 'Request Custom Quote',
  customQuoteButtonPath: '/contact',
  highlightServiceId: '',
};

export const defaultNavigationContent: NavigationContent = {
  primaryLinks: [
    { label: 'Home', path: '/', enabled: true },
    { label: 'Services', path: '/services', enabled: true },
    { label: 'Repair', path: '/auto-repair', enabled: true },
    { label: 'Showcase', path: '/gallery', enabled: true },
    { label: 'Fleet', path: '/fleet', enabled: true },
    { label: 'About', path: '/about', enabled: true },
    { label: 'Contact', path: '/contact', enabled: true },
  ],
  secondaryLinks: [
    { label: 'FAQ', path: '/faq', enabled: true },
    { label: 'Gift Cards', path: '/gift-cards', enabled: true },
    { label: 'Dashboard', path: '/dashboard', enabled: true },
    { label: 'Admin', path: '/admin', enabled: true },
  ],
  bookingCtaLabel: 'Book Now',
  bookingCtaPath: '/booking',
};

export const defaultSiteSettingsContent: SiteSettingsContent = {
  businessName: 'Spa for Cars',
  serviceNotice: 'Complimentary pick-up & drop off available (within close radius of the store only)',
  contactEmail: 'info@spaforcars.ca',
  contactPhone: '(416) 986-4746',
  topBarHours: 'Mon-Sat 8:00 AM - 6:00 PM',
  address: 'Aurora, Ontario',
  instagramUrl: 'https://www.instagram.com',
  tiktokUrl: 'https://www.tiktok.com',
  footerTagline: 'Designed for premium automotive care',
};
