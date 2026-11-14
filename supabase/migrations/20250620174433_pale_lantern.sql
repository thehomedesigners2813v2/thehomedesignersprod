/*
  # Add AI Chatbot Support System

  1. New Tables
    - `chat_conversations` - Store chat sessions
    - `chat_messages` - Store individual messages
    - `chatbot_knowledge` - Store knowledge base for the AI

  2. Security
    - Enable RLS on all tables
    - Add policies for users to manage their own conversations
    - Add policies for system to access knowledge base
*/

-- Create chat conversations table
CREATE TABLE IF NOT EXISTS chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id text UNIQUE NOT NULL,
  title text,
  status text DEFAULT 'active', -- 'active', 'closed', 'archived'
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES chat_conversations(id) ON DELETE CASCADE,
  message text NOT NULL,
  sender text NOT NULL, -- 'user' or 'bot'
  message_type text DEFAULT 'text', -- 'text', 'quick_reply', 'suggestion'
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Create chatbot knowledge base table
CREATE TABLE IF NOT EXISTS chatbot_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  question text NOT NULL,
  answer text NOT NULL,
  keywords text[] DEFAULT '{}',
  priority integer DEFAULT 1, -- Higher priority answers shown first
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_knowledge ENABLE ROW LEVEL SECURITY;

-- Policies for chat_conversations
DROP POLICY IF EXISTS "Users can manage own conversations" ON chat_conversations;
CREATE POLICY "Users can manage own conversations"
  ON chat_conversations
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Anonymous users can create conversations" ON chat_conversations;
CREATE POLICY "Anonymous users can create conversations"
  ON chat_conversations
  FOR INSERT
  TO anon
  WITH CHECK (user_id IS NULL);

DROP POLICY IF EXISTS "Anonymous users can read own conversations" ON chat_conversations;
CREATE POLICY "Anonymous users can read own conversations"
  ON chat_conversations
  FOR SELECT
  TO anon
  USING (user_id IS NULL);

-- Policies for chat_messages
DROP POLICY IF EXISTS "Users can manage messages in own conversations" ON chat_messages;
CREATE POLICY "Users can manage messages in own conversations"
  ON chat_messages
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_conversations 
      WHERE id = chat_messages.conversation_id 
      AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Anonymous users can manage messages in own conversations" ON chat_messages;
CREATE POLICY "Anonymous users can manage messages in own conversations"
  ON chat_messages
  FOR ALL
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM chat_conversations 
      WHERE id = chat_messages.conversation_id 
      AND user_id IS NULL
    )
  );

-- Policies for chatbot_knowledge
DROP POLICY IF EXISTS "Everyone can read active knowledge" ON chatbot_knowledge;
CREATE POLICY "Everyone can read active knowledge"
  ON chatbot_knowledge
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_chat_conversations_updated_at ON chat_conversations;
CREATE TRIGGER update_chat_conversations_updated_at
  BEFORE UPDATE ON chat_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_chatbot_knowledge_updated_at ON chatbot_knowledge;
CREATE TRIGGER update_chatbot_knowledge_updated_at
  BEFORE UPDATE ON chatbot_knowledge
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert knowledge base data
INSERT INTO chatbot_knowledge (category, question, answer, keywords, priority) VALUES
-- General Information
('general', 'What is TheHomeDesigners?', 'TheHomeDesigners is India''s premier interior design platform that connects homeowners with talented interior designers. We help transform your space into a beautiful home that reflects your unique style.', ARRAY['about', 'company', 'platform', 'what is'], 10),

('general', 'How does TheHomeDesigners work?', 'Our platform works in simple steps: 1) Register your project with your requirements, 2) Get matched with expert designers, 3) Collaborate on your design, 4) Transform your space. You can browse designers, share your project, and track progress all in one place.', ARRAY['how it works', 'process', 'steps'], 9),

-- Services
('services', 'What services do you offer?', 'We offer comprehensive interior design services including: Space Planning, 3D Visualization, Furniture Selection, Color Consultation, Lighting Design, Kitchen Design, Bathroom Renovation, Complete Home Makeovers, and Project Management.', ARRAY['services', 'what do you offer', 'design services'], 10),

('services', 'Do you provide 3D visualization?', 'Yes! Many of our designers offer 3D visualization services to help you see your space before implementation. This includes 3D renderings, virtual walkthroughs, and detailed design presentations.', ARRAY['3d', 'visualization', 'rendering', 'virtual'], 8),

('services', 'Can you help with kitchen design?', 'Absolutely! Our designers specialize in kitchen renovations and design. We help with layout planning, cabinet selection, countertop choices, lighting, and creating functional yet beautiful cooking spaces.', ARRAY['kitchen', 'renovation', 'cooking', 'cabinets'], 8),

-- Designers
('designers', 'How do I find the right designer?', 'You can browse our designer profiles, filter by location, specialization, and experience. Each designer has a detailed profile with their portfolio, services, ratings, and starting prices. You can also register your project and get matched with suitable designers.', ARRAY['find designer', 'choose designer', 'select designer'], 9),

('designers', 'Are your designers verified?', 'Yes, we have a verification process for our designers. Verified designers have completed our screening process and have proven experience. Look for the "Verified" badge on designer profiles.', ARRAY['verified', 'trusted', 'qualified', 'certified'], 8),

('designers', 'What specializations do your designers have?', 'Our designers specialize in various styles including Modern & Contemporary, Traditional Indian, Minimalist Design, Luxury & High-End, Eco-Friendly Design, Industrial & Loft, Scandinavian, and more.', ARRAY['specialization', 'styles', 'design styles', 'types'], 7),

-- Pricing
('pricing', 'How much does interior design cost?', 'Interior design costs vary based on project scope, location, and designer experience. Our designers have starting prices ranging from ₹35,000 to ₹1,00,000+. You can see each designer''s starting price on their profile and get custom quotes for your specific project.', ARRAY['cost', 'price', 'budget', 'expensive', 'cheap'], 10),

('pricing', 'Do you offer payment plans?', 'Payment terms vary by designer. Many offer flexible payment schedules tied to project milestones. Discuss payment options directly with your chosen designer during consultation.', ARRAY['payment', 'installment', 'payment plan', 'finance'], 7),

-- Process
('process', 'How do I register my project?', 'Click "Register Your Project" on our homepage, fill in your project details including location, budget, timeline, and requirements. Once submitted, you can browse designers or wait to be matched with suitable professionals.', ARRAY['register', 'submit project', 'start project', 'sign up'], 9),

('process', 'How long does a typical project take?', 'Project timelines vary based on scope and complexity. Typical timelines range from 1-2 months for small spaces to 6-12 months for complete home makeovers. Your designer will provide a detailed timeline during consultation.', ARRAY['timeline', 'duration', 'how long', 'time'], 8),

('process', 'Can I track my project progress?', 'Yes! Our platform includes project tracking features. You can view project activity logs, version history, communicate with your designer, and monitor progress through our dashboard.', ARRAY['track', 'progress', 'monitor', 'status'], 8),

-- Locations
('locations', 'Which cities do you serve?', 'We serve major cities across India including Mumbai, Delhi, Bangalore, Hyderabad, Chennai, Kolkata, Pune, Ahmedabad, Jaipur, Gurgaon, and many more. Our designer network spans across the country.', ARRAY['cities', 'locations', 'areas', 'where'], 8),

('locations', 'Do you work in my city?', 'We have designers in most major Indian cities. When registering your project, select your city to see available designers in your area. If we don''t have designers in your specific location, we can help connect you with nearby professionals.', ARRAY['my city', 'available', 'local designers'], 7),

-- Support
('support', 'How can I contact customer support?', 'You can reach our support team through this chat, email us at info@thehomedesigners.com, or call +91 98765 43210. We''re here to help with any questions about our platform or services.', ARRAY['contact', 'support', 'help', 'customer service'], 9),

('support', 'What if I''m not satisfied with my designer?', 'We want you to be completely satisfied. If you''re not happy with your designer match, contact our support team and we''ll help you find a better fit. Communication is key, and we''re here to facilitate the best possible experience.', ARRAY['not satisfied', 'unhappy', 'change designer', 'complaint'], 8),

-- Account
('account', 'Do I need to create an account?', 'While you can browse designers without an account, you''ll need to sign up to register projects, communicate with designers, and track your progress. Creating an account is free and takes just a few minutes.', ARRAY['account', 'sign up', 'register', 'login'], 7),

('account', 'How do I become a designer on your platform?', 'If you''re an interior designer, click "Register as Designer" to join our platform. You''ll need to provide your credentials, portfolio, and complete our verification process. Once approved, you can start receiving project assignments.', ARRAY['become designer', 'join platform', 'designer registration'], 8);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_id ON chat_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_session_id ON chat_conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chatbot_knowledge_keywords ON chatbot_knowledge USING GIN(keywords);
CREATE INDEX IF NOT EXISTS idx_chatbot_knowledge_category ON chatbot_knowledge(category);