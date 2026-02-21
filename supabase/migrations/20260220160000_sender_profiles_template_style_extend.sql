-- Extend allowed email template styles for sender profiles (activate creative, corporate, bold, elegant)
ALTER TABLE public.sender_profiles
  DROP CONSTRAINT IF EXISTS sender_profiles_template_style_check;

ALTER TABLE public.sender_profiles
  ADD CONSTRAINT sender_profiles_template_style_check
  CHECK (template_style IN (
    'professional', 'minimal', 'modern',
    'creative', 'corporate', 'bold', 'elegant'
  ));
