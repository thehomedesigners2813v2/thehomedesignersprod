DELETE FROM public.chatbot_knowledge;

INSERT INTO public.chatbot_knowledge (category, question, answer, keywords, priority, is_active)
VALUES
(
  'services',
  'What interior design services do you offer?',
  'TheHomeDesigners connects homeowners in Pune with verified interior designers. Designers can help with full-home design, single rooms, kitchens, wardrobes, space planning, material selection, 3D visualization, and project execution. Open Designers to compare profiles, or register your project to request quotations.',
  ARRAY['services', 'offer', 'design', 'interior', 'kitchen', 'wardrobe', 'room', 'home'],
  10,
  true
),
(
  '3d_visualization',
  'Do you offer 3D visualization?',
  'Yes. Designers on the platform can share 3D views of a room before work begins. You can also browse the 3D Wallpaper gallery, choose Standard, Luxury, or Premium paper, and place an order. Those paper rates are per square foot and include installation: Standard ₹160, Luxury ₹190, and Premium ₹220.',
  ARRAY['3d', 'visualization', 'render', 'wallpaper', 'paper'],
  8,
  true
),
(
  'partial_design',
  'Can I get partial room design?',
  'Yes. You can ask a designer for one room, a kitchen, a wardrobe, or a full home. Register the project with what you want done, and the designer quotation will cover that scope.',
  ARRAY['partial', 'single room', 'one room', 'kitchen', 'wardrobe'],
  8,
  true
),
(
  'find_designer',
  'How do I find the right designer?',
  'Open Designers, choose Pune, then choose the area. Each profile shows the designer''s work, services, and completed projects. You can also register your project and request a quotation from a designer.',
  ARRAY['find designer', 'choose designer', 'designer', 'area', 'pune'],
  9,
  true
),
(
  'verification',
  'How are designers verified?',
  'A designer profile is shown to customers after verification. Look for the verified badge on the designer profile before you request a quotation.',
  ARRAY['verified', 'verification', 'trusted', 'badge'],
  8,
  true
),
(
  'reviews',
  'Can I see designer reviews?',
  'Yes. Open a designer profile to see the portfolio and homeowner reviews that have been published for that designer.',
  ARRAY['reviews', 'rating', 'feedback', 'portfolio'],
  8,
  true
),
(
  'pricing',
  'How much does interior design cost?',
  'Interior design prices are set by the designer for your home, not as one rate for every project. Open a designer profile for the published starting point, then register your project or request a quotation for the actual price. 3D wallpaper paper is separate: Standard ₹160, Luxury ₹190, and Premium ₹220 per square foot, including installation.',
  ARRAY['cost', 'price', 'pricing', 'budget', 'quote', 'quotation', 'rate', 'charges'],
  10,
  true
),
(
  'process',
  'How do I register my project?',
  'Use Register Your Project on the home page. Add your Pune area, budget, and what you want designed. Designers can then send a quotation. You need an account to register a project and to read quotations.',
  ARRAY['register', 'project', 'start', 'signup', 'sign up'],
  9,
  true
),
(
  'quotations',
  'How do quotations work?',
  'After you register a project, a designer prepares a quotation with rooms, items, and a total. You can read it from your account, compare it, and accept it when you are ready. The price in the quotation is the price for that project.',
  ARRAY['quotation', 'quote', 'estimate', 'proposal'],
  9,
  true
),
(
  'locations',
  'Which cities do you serve?',
  'TheHomeDesigners currently provides designer services in Pune. Choose Pune and then your area, such as Baner, Kothrud, Wakad, Hinjewadi, or Viman Nagar, when you search or register.',
  ARRAY['city', 'cities', 'pune', 'location', 'area', 'mumbai', 'where'],
  10,
  true
),
(
  'support',
  'How can I contact customer support?',
  'Email supportcontact@thehomedesigners.in. This chat answers questions about designers, projects, quotations, and 3D wallpaper in Pune.',
  ARRAY['contact', 'support', 'email', 'help', 'phone'],
  9,
  true
),
(
  'account',
  'Do I need to create an account?',
  'You can browse designers and the 3D wallpaper gallery without an account. Create a free account to register a project, request a quotation, and read messages from a designer.',
  ARRAY['account', 'login', 'sign up', 'register'],
  7,
  true
);
