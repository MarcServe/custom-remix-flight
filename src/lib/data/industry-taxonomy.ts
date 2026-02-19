/**
 * Enterprise CRM Industry Taxonomy (Neutral, Scalable)
 * Merged from: NAICS/LinkedIn alignment, Social Care & SEN depth,
 * Accessibility & Inclusion coverage, and neutral enterprise framework.
 * Supports B2B/B2C, regulated sectors, and international search.
 */

export const industryTaxonomy: Record<string, string[]> = {
  'Government & Public Sector': [
    'Local Authorities',
    'County Councils',
    'Borough Councils',
    'Adult Social Care Commissioning',
    'Children\'s Services Departments',
    'SEND Departments',
    'Public Health',
    'Government Agencies',
    'Regulatory Bodies',
    'Procurement & Commissioning',
    'Housing Authorities',
    'Public Administration',
    'Defense & Security',
    'Civic Tech / GovTech',
    'Electoral Services',
    'Public Consultation Platforms',
    'Integrated Care Boards (ICB)',
    'NHS Trust Community Services',
    'Law Enforcement & Emergency Services'
  ],
  'Healthcare': [
    'NHS Trusts',
    'Private Hospitals',
    'Hospitals & Healthcare Systems',
    'Clinics',
    'Primary Care Networks',
    'GP Practices',
    'Community Health Services',
    'Mental Health Services',
    'CAMHS',
    'Diagnostics & Labs',
    'Telehealth / Telemedicine',
    'Rehabilitation Centres',
    'Learning Disability Nursing',
    'Integrated Care Systems',
    'Pharmaceuticals',
    'Biotechnology',
    'Medical Devices & Equipment',
    'HealthTech / Digital Health',
    'Clinical Trials & CROs',
    'Public Health',
    'Health Charities',
    'Complex Care Providers',
    'Social Prescribing Services'
  ],
  'Social Care': [
    'Adult Social Care',
    'Children\'s Social Care',
    'Learning Disability Services',
    'Intellectual Disability Support',
    'Autism Services',
    'Neurodiversity Support',
    'Supported Living Providers',
    'Residential Care (LD)',
    'Day Centres',
    'Outreach Support',
    'Respite Services',
    'Behavioural Support',
    'PBS (Positive Behaviour Support)',
    'Disability Advocacy',
    'Carer Support Services',
    'Complex Needs Care',
    'Specialist Housing Providers',
    'Disability Employment Support',
    'Care Quality Consultancy',
    'Social Work Services',
    'Safeguarding Services',
    'Home Care / Domiciliary Care',
    'Care Assessment Services',
    'Transition Services (Child to Adult)',
    'Commissioned Care Providers'
  ],
  'Education': [
    'Primary Schools',
    'Secondary Schools',
    'Academies',
    'Higher Education / Universities',
    'SEN Schools',
    'SEN Colleges',
    'Alternative Provision Schools',
    'Inclusive Education Providers',
    'Vocational & Technical Schools',
    'Online Education (EdTech)',
    'Corporate Training & Learning Platforms',
    'Educational Psychology',
    'Learning Support Services',
    'SEN Consultancy',
    'Autism Education Providers',
    'Research & Development Institutes',
    'Publishing (Academic & Educational)',
    'Specialist Training Providers (Care Sector)'
  ],
  'Housing & Real Estate': [
    'Housing Associations',
    'Social Housing Providers',
    'Supported Accommodation',
    'Property Management',
    'Letting Agencies',
    'Estate Agencies',
    'Real Estate Development',
    'Commercial Real Estate',
    'Residential Real Estate',
    'Retirement Living',
    'Specialist Disability Housing',
    'Student Housing Providers',
    'REITs',
    'Property Developers'
  ],
  'Nonprofit & Charity': [
    'Disability Charities',
    'Autism Charities',
    'Mental Health Charities',
    'Youth Charities',
    'Community Interest Companies',
    'Grant-Making Foundations',
    'Faith-Based Organisations',
    'Advocacy Groups',
    'International NGOs',
    'Environmental NGOs',
    'Food Banks',
    'Homelessness Charities',
    'Refugee Services',
    'Crisis Helplines',
    'Domestic Abuse Support',
    'Disaster Relief Organisations'
  ],
  'Banking & Financial Services': [
    'Banks',
    'Building Societies',
    'Credit Unions',
    'Retail Banking',
    'Investment Management',
    'Wealth Management',
    'Asset Management',
    'FinTech & Digital Payments',
    'Payment Providers',
    'Stock Exchanges & Brokerage',
    'Financial Advisory',
    'Corporate Finance',
    'Accounting & Auditing',
    'Crowdfunding Platforms',
    'Lending Platforms',
    'RegTech / Compliance Platforms'
  ],
  'Insurance': [
    'General Insurance',
    'Health Insurance',
    'Travel Insurance',
    'Commercial Insurance',
    'Life & Pensions',
    'Claims Management',
    'Accident Management',
    'InsurTech'
  ],
  'Retail & Ecommerce': [
    'Grocery Retail',
    'Fashion Retail',
    'Fast Fashion',
    'Luxury Retail',
    'Beauty & Cosmetics',
    'Electronics Retail',
    'Homeware & Furniture',
    'E-Commerce & Marketplaces',
    'Direct-to-Consumer Brands',
    'Subscription Retail',
    'Marketplace Sellers',
    'Multi-Channel Retail',
    'Department Stores',
    'Supermarkets & Grocery Chains'
  ],
  'Utilities & Infrastructure': [
    'Energy Providers',
    'Water Companies',
    'Waste Management',
    'Broadband Providers',
    'Telecoms',
    'Smart Meter Providers',
    'Renewable Energy',
    'Energy Utilities (Electric, Gas)'
  ],
  'Transportation': [
    'Bus Operators',
    'Rail Operators',
    'Airlines',
    'Public Transportation',
    'Taxi & Ride-Sharing',
    'Logistics Companies',
    'Last-Mile Delivery',
    'Freight & Logistics',
    'Shipping & Maritime',
    'EV & Mobility Providers',
    'Parking Operators'
  ],
  'Legal Services': [
    'Law Firms',
    'Legal Aid Providers',
    'Barristers Chambers',
    'Corporate Legal',
    'Injury & Claims Law'
  ],
  'Digital & SaaS': [
    'SaaS Platforms',
    'AI & Machine Learning',
    'Cloud Computing & Infrastructure',
    'Cybersecurity',
    'CRM & Workflow Automation',
    'HealthTech',
    'EdTech',
    'GovTech',
    'Accessibility Tech',
    'Software Development',
    'Data Analytics & Big Data',
    'Blockchain & Web3',
    'IoT & Smart Cities',
    'AR/VR Platforms'
  ],
  'Recruitment & HR': [
    'Recruitment Agencies',
    'Job Boards',
    'Executive Search',
    'HRTech / Workforce Management',
    'Payroll & Benefits',
    'Apprenticeship Providers',
    'Supported Employment',
    'Outsourcing / BPO',
    'Career Platforms'
  ],
  'Professional Services': [
    'Consulting (Strategy, Management, Digital)',
    'Accountancy Firms',
    'Tax Advisory',
    'Compliance & Regulatory',
    'ESG Advisory',
    'Accessibility Consultants',
    'WCAG Audit Firms',
    'Digital Inclusion Agencies',
    'Inclusive Design & UX',
    'Translation & Localization'
  ],
  'Construction': [
    'Construction Firms',
    'Civil Engineering',
    'Architecture Practices',
    'Surveyors',
    'Construction & Building Materials',
    'Facilities Management',
    'Infrastructure Development'
  ],
  'Manufacturing': [
    'Industrial Manufacturing',
    'Equipment Manufacturers',
    'Medical Device Manufacturing',
    'Consumer Goods Manufacturing',
    'Automotive Manufacturing',
    'Aerospace & Defense Manufacturing',
    'Machinery & Equipment',
    'Food & Beverage Manufacturing',
    'Industrial Automation & Robotics'
  ],
  'Automotive': [
    'Automotive Manufacturing',
    'Vehicle Retail & Leasing',
    'EV & Mobility',
    'Parts & Supply'
  ],
  'Defence & Aerospace': [
    'Defence Contractors',
    'Aerospace & Aviation',
    'Security Firms',
    'Surveillance & Cybersecurity'
  ],
  'Agriculture & Rural': [
    'Agricultural Suppliers',
    'Farm Retailers',
    'Farming Cooperatives',
    'AgriTech',
    'Forestry & Timber',
    'Rural Support Charities'
  ],
  'Energy & Utilities': [
    'Renewable Energy',
    'Solar & Wind',
    'Oil & Gas',
    'Energy Utilities',
    'Climate Tech',
    'Carbon Offset & ESG'
  ],
  'Environmental & Climate': [
    'Environmental Services',
    'CleanTech & Carbon Management',
    'Waste Management & Recycling',
    'Sustainability & ESG Consulting',
    'ClimateTech',
    'Water Management',
    'Environmental Consulting'
  ],
  'Logistics & Supply Chain': [
    'Warehousing',
    'Courier & Express Delivery',
    'Freight Operators',
    'Distribution Networks',
    'Fulfilment & 3PL',
    'Supply Chain Management'
  ],
  'Hospitality': [
    'Hotels & Resorts',
    'Hostels',
    'Restaurants',
    'Catering Services',
    'Event Venues',
    'Conference Centres'
  ],
  'Tourism & Travel': [
    'Travel Agencies',
    'Tour Operators',
    'Airlines & Cruise',
    'Holiday Parks',
    'Adventure & Ecotourism',
    'TravelTech'
  ],
  'Entertainment & Media': [
    'Media & Broadcasting',
    'Streaming Services',
    'News & Publishing',
    'Podcast & Digital Content',
    'Film, TV & Video Production',
    'Gaming & eSports'
  ],
  'Marketing & Advertising': [
    'Advertising & Marketing',
    'Digital Marketing / Martech',
    'SEO & SEM Agencies',
    'Creative Agencies',
    'Design & Branding',
    'Public Relations',
    'Influencer Marketing'
  ],
  'Membership Organisations': [
    'Professional Bodies',
    'Trade Associations',
    'Chambers of Commerce',
    'Unions',
    'Subscription & Loyalty Platforms'
  ],
  'Venture Capital & Investment': [
    'Venture Capital',
    'Private Equity',
    'Investment Platforms',
    'Corporate Ventures',
    'Grant-Making Bodies'
  ],
  'Corporate Enterprises': [
    'FTSE 100 / Large Cap',
    'FTSE 250 / Mid Cap',
    'Multinationals',
    'ESG Reporting Organisations',
    'Corporate Foundations'
  ],
  'Consumer Goods': [
    'FMCG',
    'Consumer Electronics',
    'Packaging & Supply',
    'Wholesale & Distribution'
  ],
  'Wholesale & Distribution': [
    'Wholesale',
    'Distribution Networks',
    'B2B Supply',
    'Import/Export'
  ],
  'Food & Beverage': [
    'Restaurant Chains',
    'Food Delivery Platforms',
    'Catering & Events',
    'Coffee & Quick Service',
    'Hospitality Groups'
  ],
  'Fashion & Apparel': [
    'Fashion Retail',
    'Footwear',
    'Luxury & Designer',
    'Textiles & Apparel Manufacturing'
  ],
  'Sports & Leisure': [
    'Gyms & Fitness',
    'Sports Clubs',
    'Football & Major League',
    'Esports',
    'Theme Parks & Attractions',
    'Casinos & Entertainment'
  ],
  'Events & Experiences': [
    'Festivals',
    'Exhibition Centres',
    'Conference Organisers',
    'Ticketing Platforms',
    'Live Events'
  ],
  'Telecommunications': [
    'Internet Service Providers',
    'Mobile Networks',
    'Broadband & Fiber',
    'Data Centers',
    'Satellite Communications'
  ],
  'Technology Hardware': [
    'Computer Hardware & Semiconductors',
    'Devices & Electronics',
    'IoT Hardware'
  ],
  'Biotechnology': [
    'Biotech Research',
    'Pharma R&D',
    'Medical Biotechnology',
    'Agricultural Biotechnology'
  ],
  'Engineering': [
    'Civil Engineering',
    'Mechanical & Electrical',
    'Industrial Engineering',
    'Land Surveying & Mapping'
  ],
  'Human Services & Welfare': [
    'Food Banks',
    'Community Kitchens',
    'Family Support Services',
    'Addiction Recovery',
    'Youth Offending Services',
    'Prison Rehabilitation',
    'Refugee Services'
  ],
  'Emergency & Critical Services': [
    'Ambulance Services',
    'Fire & Rescue',
    'Crisis Helplines',
    'Safeguarding Hotlines',
    'Suicide Prevention',
    'Domestic Abuse Support'
  ],
  'Cultural Institutions': [
    'Museums',
    'Libraries',
    'Theatres',
    'Art Galleries',
    'Heritage Sites'
  ],
  'Faith & Religious Organisations': [
    'Churches',
    'Mosques',
    'Synagogues',
    'Religious Charities',
    'Faith Education',
    'Religious Community Centres'
  ],
  'Higher Regulation Industries': [
    'Gambling & Betting',
    'Online Gaming',
    'Cryptocurrency Exchanges',
    'Trading Platforms',
    'Payday Lending',
    'BNPL Providers'
  ],
  'Other / Emerging Industries': [
    'Other Specialized Services',
    'Emerging Tech',
    'Hybrid Sectors',
    'New Verticals'
  ]
};

/**
 * Get all primary industry categories (sorted for UI)
 */
export const getIndustryCategories = (): string[] => {
  return Object.keys(industryTaxonomy);
};

/**
 * Get subcategories for a specific primary sector
 */
export const getIndustrySubcategories = (category: string): string[] => {
  return industryTaxonomy[category] || [];
};

/**
 * Format industry string for search/API (subcategory in context of sector)
 */
export const formatIndustryString = (category: string, subcategory: string): string => {
  return `${subcategory} (${category})`;
};
