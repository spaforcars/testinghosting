// Copy these schema definitions into your Sanity Studio project.
// They are provided here to keep the website and CMS content model aligned.

export const siteSettings = {
  name: 'siteSettings',
  type: 'document',
  title: 'Site Settings',
  fields: [
    { name: 'businessName', type: 'string', title: 'Business Name' },
    { name: 'serviceNotice', type: 'string', title: 'Service Notice' },
    { name: 'contactEmail', type: 'string', title: 'Contact Email' },
    { name: 'contactPhone', type: 'string', title: 'Contact Phone' },
    { name: 'topBarHours', type: 'string', title: 'Top Bar Hours' },
    { name: 'address', type: 'string', title: 'Address' },
    { name: 'instagramUrl', type: 'url', title: 'Instagram URL' },
    { name: 'tiktokUrl', type: 'url', title: 'TikTok URL' },
    { name: 'footerTagline', type: 'string', title: 'Footer Tagline' },
  ],
};

export const navigationConfig = {
  name: 'navigationConfig',
  type: 'document',
  title: 'Navigation Config',
  fields: [
    {
      name: 'primaryLinks',
      title: 'Primary Links',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            { name: 'label', type: 'string' },
            { name: 'path', type: 'string' },
            { name: 'enabled', type: 'boolean', initialValue: true },
          ],
        },
      ],
    },
    {
      name: 'secondaryLinks',
      title: 'Secondary Links',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            { name: 'label', type: 'string' },
            { name: 'path', type: 'string' },
            { name: 'enabled', type: 'boolean', initialValue: true },
          ],
        },
      ],
    },
    { name: 'bookingCtaLabel', type: 'string', title: 'Booking CTA Label' },
    { name: 'bookingCtaPath', type: 'string', title: 'Booking CTA Path' },
  ],
};

export const promoPlacement = {
  name: 'promoPlacement',
  type: 'document',
  title: 'Promo Placement',
  fields: [
    { name: 'slot', type: 'string', title: 'Slot (e.g. home, services)' },
    { name: 'title', type: 'string' },
    { name: 'message', type: 'text' },
    { name: 'ctaLabel', type: 'string' },
    { name: 'ctaLink', type: 'url' },
    { name: 'image', type: 'string', title: 'Image URL or /client-images path' },
    { name: 'enabled', type: 'boolean', initialValue: true },
    { name: 'startAt', type: 'datetime' },
    { name: 'endAt', type: 'datetime' },
  ],
};

export const homePage = {
  name: 'homePage',
  type: 'document',
  title: 'Home Page',
  fields: [
    { name: 'heroTitle', type: 'string' },
    { name: 'heroAccent', type: 'string' },
    { name: 'heroSubtitle', type: 'string' },
    { name: 'heroImage', type: 'string', title: 'Hero Image URL or /client-images path' },
    { name: 'heroButtonLabel', type: 'string' },
    { name: 'heroButtonPath', type: 'string' },
    { name: 'whyTitle', type: 'string' },
    { name: 'whyBody', type: 'text' },
    {
      name: 'whyFeatures',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            {
              name: 'icon',
              type: 'string',
              options: {
                list: [
                  { title: 'Shield', value: 'shield' },
                  { title: 'Droplets', value: 'droplets' },
                  { title: 'Car', value: 'car' },
                  { title: 'Sparkles', value: 'sparkles' },
                ],
              },
            },
            { name: 'title', type: 'string' },
            { name: 'description', type: 'text' },
          ],
        },
      ],
    },
    { name: 'showcaseBadge', type: 'string' },
    { name: 'showcaseTitle', type: 'string' },
    { name: 'showcaseViewAllLabel', type: 'string' },
    { name: 'showcaseViewAllPath', type: 'string' },
    {
      name: 'showcaseServices',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            { name: 'title', type: 'string' },
            { name: 'price', type: 'string' },
            { name: 'image', type: 'string', title: 'Image URL or /client-images path' },
            { name: 'bookingServiceId', type: 'string' },
          ],
        },
      ],
    },
    { name: 'testimonialQuote', type: 'text' },
    { name: 'testimonialAuthor', type: 'string' },
    { name: 'galleryBadge', type: 'string' },
    { name: 'galleryTitle', type: 'string' },
    { name: 'galleryViewAllLabel', type: 'string' },
    { name: 'galleryViewAllPath', type: 'string' },
    { name: 'galleryImages', type: 'array', of: [{ type: 'string' }], title: 'Gallery Images (URLs or /client-images paths)' },
    { name: 'ctaTitle', type: 'string' },
    { name: 'ctaBody', type: 'text' },
    { name: 'ctaButtonLabel', type: 'string' },
    { name: 'ctaButtonPath', type: 'string' },
  ],
};

const serviceOfferingFields = [
  { name: 'id', type: 'string', title: 'Stable ID' },
  { name: 'title', type: 'string', title: 'Title' },
  { name: 'shortTitle', type: 'string', title: 'Short Title' },
  { name: 'description', type: 'text', title: 'Description' },
  {
    name: 'category',
    type: 'string',
    title: 'Category',
    options: {
      list: [
        { title: 'Detailing', value: 'detailing' },
        { title: 'Maintenance', value: 'maintenance' },
        { title: 'Protection', value: 'protection' },
        { title: 'Window Tinting', value: 'tint' },
        { title: 'Restoration', value: 'restoration' },
        { title: 'Add-On', value: 'add_on' },
      ],
    },
  },
  { name: 'priceLabel', type: 'string', title: 'Price Label' },
  { name: 'fixedPriceAmount', type: 'number', title: 'Fixed Price Amount' },
  { name: 'duration', type: 'string', title: 'Duration' },
  { name: 'image', type: 'string', title: 'Image URL or /client-images path' },
  { name: 'features', type: 'array', of: [{ type: 'string' }], title: 'Features' },
  { name: 'notes', type: 'text', title: 'Notes' },
  { name: 'bookable', type: 'boolean', title: 'Bookable' },
  { name: 'addOnOnly', type: 'boolean', title: 'Add-On Only' },
];

export const servicesPage = {
  name: 'servicesPage',
  type: 'document',
  title: 'Services Page',
  fields: [
    { name: 'badge', type: 'string' },
    { name: 'title', type: 'string' },
    { name: 'subtitle', type: 'text' },
    { name: 'detailingPackagesTitle', type: 'string', title: 'Detailing Packages Title' },
    {
      name: 'detailingOfferings',
      type: 'array',
      title: 'Detailing Offerings',
      of: [{ type: 'object', fields: serviceOfferingFields }],
    },
    {
      name: 'detailingPackages',
      type: 'array',
      title: 'Detailing Price Matrix',
      of: [
        {
          type: 'object',
          fields: [
            { name: 'vehicleType', type: 'string', title: 'Vehicle Type' },
            { name: 'fullDetailId', type: 'string', title: 'Full Detail Offering ID' },
            { name: 'interiorOnlyId', type: 'string', title: 'Interior Only Offering ID' },
          ],
        },
      ],
    },
    { name: 'exteriorIncludesTitle', type: 'string', title: 'Exterior Includes Title' },
    {
      name: 'exteriorIncludes',
      type: 'array',
      title: 'Exterior Includes',
      of: [{ type: 'string' }],
    },
    { name: 'interiorIncludesTitle', type: 'string', title: 'Interior Includes Title' },
    {
      name: 'interiorIncludes',
      type: 'array',
      title: 'Interior Includes',
      of: [{ type: 'string' }],
    },
    { name: 'specialtyServicesTitle', type: 'string', title: 'Specialty Services Title' },
    {
      name: 'specialtyServices',
      type: 'array',
      title: 'Specialty Services',
      of: [{ type: 'object', fields: serviceOfferingFields }],
    },
    { name: 'additionalServicesTitle', type: 'string', title: 'Additional Services Title' },
    {
      name: 'additionalServices',
      type: 'array',
      title: 'Additional Services',
      of: [{ type: 'object', fields: serviceOfferingFields }],
    },
    {
      name: 'featuredOfferingIds',
      type: 'array',
      title: 'Featured Offering IDs',
      of: [{ type: 'string' }],
    },
  ],
};

export const fleetPage = {
  name: 'fleetPage',
  type: 'document',
  title: 'Fleet Page',
  fields: [
    { name: 'badge', type: 'string' },
    { name: 'title', type: 'string' },
    { name: 'subtitle', type: 'text' },
    { name: 'dealershipsTitle', type: 'string' },
    { name: 'dealershipsItems', type: 'array', of: [{ type: 'string' }] },
    { name: 'fleetsTitle', type: 'string' },
    { name: 'fleetsItems', type: 'array', of: [{ type: 'string' }] },
    { name: 'proposalTitle', type: 'string' },
    { name: 'proposalSubtitle', type: 'text' },
  ],
};

export const faqPage = {
  name: 'faqPage',
  type: 'document',
  title: 'FAQ Page',
  fields: [
    {
      name: 'items',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            { name: 'question', type: 'string' },
            { name: 'answer', type: 'text' },
          ],
        },
      ],
    },
  ],
};

export const contactPage = {
  name: 'contactPage',
  type: 'document',
  title: 'Contact Page',
  fields: [
    { name: 'title', type: 'string' },
    { name: 'subtitle', type: 'text' },
    { name: 'address', type: 'text' },
    { name: 'mapEmbedUrl', type: 'url' },
  ],
};

export const aboutPage = {
  name: 'aboutPage',
  type: 'document',
  title: 'About Page',
  fields: [
    { name: 'badge', type: 'string', title: 'Badge' },
    { name: 'title', type: 'string', title: 'Title' },
    { name: 'subtitle', type: 'text', title: 'Subtitle' },
    { name: 'image', type: 'string', title: 'Main Image URL or /client-images path' },
    { name: 'imageBadge', type: 'string', title: 'Image Badge' },
    { name: 'evolutionTitle', type: 'string', title: 'Evolution Title' },
    { name: 'evolutionBody', type: 'text', title: 'Evolution Body' },
    {
      name: 'valueCards',
      type: 'array',
      title: 'Value Cards',
      of: [
        {
          type: 'object',
          fields: [
            {
              name: 'icon',
              type: 'string',
              options: {
                list: [
                  { title: 'Award', value: 'award' },
                  { title: 'Heart', value: 'heart' },
                  { title: 'Users', value: 'users' },
                ],
              },
            },
            { name: 'title', type: 'string' },
            { name: 'description', type: 'text' },
          ],
        },
      ],
    },
  ],
};

export const galleryPage = {
  name: 'galleryPage',
  type: 'document',
  title: 'Gallery Page',
  fields: [
    { name: 'badge', type: 'string', title: 'Badge' },
    { name: 'title', type: 'string', title: 'Title' },
    { name: 'subtitle', type: 'text', title: 'Subtitle' },
    {
      name: 'transformations',
      type: 'array',
      title: 'Before/After Transformations',
      of: [
        {
          type: 'object',
          fields: [
            { name: 'label', type: 'string' },
            { name: 'beforeImage', type: 'string', title: 'Before Image URL or /client-images path' },
            { name: 'afterImage', type: 'string', title: 'After Image URL or /client-images path' },
          ],
        },
      ],
    },
  ],
};

export const autoRepairPage = {
  name: 'autoRepairPage',
  type: 'document',
  title: 'Auto Repair Page',
  fields: [
    { name: 'badge', type: 'string', title: 'Badge' },
    { name: 'title', type: 'string', title: 'Title' },
    { name: 'subtitle', type: 'text', title: 'Subtitle' },
    { name: 'inputPlaceholder', type: 'string', title: 'Input Placeholder' },
    { name: 'submitButtonLabel', type: 'string', title: 'Submit Button Label' },
    { name: 'submittingButtonLabel', type: 'string', title: 'Submitting Button Label' },
    { name: 'successTitle', type: 'string', title: 'Success Title' },
    { name: 'successMessage', type: 'text', title: 'Success Message' },
  ],
};

export const giftCardsPage = {
  name: 'giftCardsPage',
  type: 'document',
  title: 'Gift Cards Page',
  fields: [
    { name: 'badge', type: 'string', title: 'Badge' },
    { name: 'title', type: 'string', title: 'Title' },
    { name: 'subtitle', type: 'text', title: 'Subtitle' },
    { name: 'cardBrand', type: 'string', title: 'Card Brand' },
    { name: 'cardTitle', type: 'string', title: 'Card Title' },
    { name: 'cardTagline', type: 'string', title: 'Card Tagline' },
    { name: 'benefits', type: 'array', title: 'Benefits', of: [{ type: 'string' }] },
    { name: 'configureTitle', type: 'string', title: 'Configure Title' },
    { name: 'presetAmounts', type: 'array', title: 'Preset Amounts', of: [{ type: 'number' }] },
    { name: 'minCustomAmount', type: 'number', title: 'Minimum Custom Amount' },
    { name: 'recipientEmailLabel', type: 'string', title: 'Recipient Email Label' },
    { name: 'senderNameLabel', type: 'string', title: 'Sender Name Label' },
    { name: 'messageLabel', type: 'string', title: 'Message Label' },
    { name: 'proceedButtonLabel', type: 'string', title: 'Proceed Button Label' },
    { name: 'proceedingButtonLabel', type: 'string', title: 'Proceeding Button Label' },
    { name: 'paymentTitle', type: 'string', title: 'Payment Title' },
    { name: 'backToConfigLabel', type: 'string', title: 'Back Label' },
    { name: 'paymentNote', type: 'string', title: 'Payment Note' },
    { name: 'successTitle', type: 'string', title: 'Success Title' },
    { name: 'successMessagePrefix', type: 'string', title: 'Success Message Prefix' },
    { name: 'resetButtonLabel', type: 'string', title: 'Reset Button Label' },
  ],
};

export const pricingPage = {
  name: 'pricingPage',
  type: 'document',
  title: 'Pricing Page',
  fields: [
    { name: 'badge', type: 'string', title: 'Badge' },
    { name: 'title', type: 'string', title: 'Title' },
    { name: 'subtitle', type: 'text', title: 'Subtitle' },
    { name: 'mostPopularBadge', type: 'string', title: 'Most Popular Badge Label' },
    { name: 'selectPlanLabel', type: 'string', title: 'Select Plan Button Label' },
    { name: 'highlightServiceId', type: 'string', title: 'Highlight Service ID' },
    { name: 'customQuoteTitle', type: 'string', title: 'Custom Quote Section Title' },
    { name: 'customQuoteBody', type: 'text', title: 'Custom Quote Section Body' },
    { name: 'customQuoteButtonLabel', type: 'string', title: 'Custom Quote Button Label' },
    { name: 'customQuoteButtonPath', type: 'string', title: 'Custom Quote Button Path' },
  ],
};
