-- =============================================================================
-- Run this in Supabase Dashboard → SQL Editor → New query
-- Adds all columns needed for Email Branding, Default Branding, and Sender
-- Profiles. Safe to run multiple times (uses IF NOT EXISTS).
-- =============================================================================

-- business_profiles (email branding, sender info, footer, signature, website)
ALTER TABLE public.business_profiles ADD COLUMN IF NOT EXISTS email_logo_url TEXT;
ALTER TABLE public.business_profiles ADD COLUMN IF NOT EXISTS email_brand_color TEXT DEFAULT '#8b5cf6';
ALTER TABLE public.business_profiles ADD COLUMN IF NOT EXISTS email_footer_text TEXT;
ALTER TABLE public.business_profiles ADD COLUMN IF NOT EXISTS email_signature TEXT;
ALTER TABLE public.business_profiles ADD COLUMN IF NOT EXISTS email_template_style TEXT DEFAULT 'professional';
ALTER TABLE public.business_profiles ADD COLUMN IF NOT EXISTS email_footer_image_url TEXT;
ALTER TABLE public.business_profiles ADD COLUMN IF NOT EXISTS email_footer_logo_url TEXT;
ALTER TABLE public.business_profiles ADD COLUMN IF NOT EXISTS email_header_name TEXT;
ALTER TABLE public.business_profiles ADD COLUMN IF NOT EXISTS email_sender_image_url TEXT;
ALTER TABLE public.business_profiles ADD COLUMN IF NOT EXISTS email_sender_name TEXT;
ALTER TABLE public.business_profiles ADD COLUMN IF NOT EXISTS email_sender_title TEXT;
ALTER TABLE public.business_profiles ADD COLUMN IF NOT EXISTS email_sender_email TEXT;
ALTER TABLE public.business_profiles ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE public.business_profiles ADD COLUMN IF NOT EXISTS email_signature_closing TEXT;
ALTER TABLE public.business_profiles ADD COLUMN IF NOT EXISTS email_sender_phone TEXT;
ALTER TABLE public.business_profiles ADD COLUMN IF NOT EXISTS email_sender_address TEXT;
ALTER TABLE public.business_profiles ADD COLUMN IF NOT EXISTS email_signature_use_structured BOOLEAN DEFAULT true;

-- profiles (avatar for sender/fallback)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- sender_profiles (per-profile branding, footer, signature, website)
ALTER TABLE public.sender_profiles ADD COLUMN IF NOT EXISTS footer_image_url TEXT;
ALTER TABLE public.sender_profiles ADD COLUMN IF NOT EXISTS footer_logo_url TEXT;
ALTER TABLE public.sender_profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE public.sender_profiles ADD COLUMN IF NOT EXISTS sender_name TEXT;
ALTER TABLE public.sender_profiles ADD COLUMN IF NOT EXISTS sender_email TEXT;
ALTER TABLE public.sender_profiles ADD COLUMN IF NOT EXISTS sender_title TEXT;
ALTER TABLE public.sender_profiles ADD COLUMN IF NOT EXISTS sender_image_url TEXT;
ALTER TABLE public.sender_profiles ADD COLUMN IF NOT EXISTS website_url TEXT;
ALTER TABLE public.sender_profiles ADD COLUMN IF NOT EXISTS signature_closing TEXT;
ALTER TABLE public.sender_profiles ADD COLUMN IF NOT EXISTS sender_phone TEXT;
ALTER TABLE public.sender_profiles ADD COLUMN IF NOT EXISTS sender_address TEXT;
ALTER TABLE public.sender_profiles ADD COLUMN IF NOT EXISTS signature_use_structured BOOLEAN DEFAULT true;
ALTER TABLE public.sender_profiles ADD COLUMN IF NOT EXISTS signature_company TEXT;
