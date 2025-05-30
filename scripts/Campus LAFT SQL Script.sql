-- Supabase Project Schema - Corrected Version

-- 0. (Optional but recommended) Create a specific schema if you want to separate it from 'public'
-- For simplicity, we'll use the 'public' schema, which is default.

-- 1. Create ENUM Types (Custom Data Types) - Idempotent
-- These ensure data consistency for certain fields.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'item_status' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
        CREATE TYPE public.item_status AS ENUM ('lost', 'found', 'claimed', 'archived');
    ELSE
        RAISE NOTICE 'Type "public.item_status" already exists, skipping creation.';
    END IF;
END$$;

-- Note: item_category ENUM creation is removed here as we are dropping it later.
-- If this is the first run, and you want to create it temporarily for migration from an older state, you can,
-- but the goal is to remove it. For a clean setup, it's not needed if you're using the categories table approach from the start.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'claim_status' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
        CREATE TYPE public.claim_status AS ENUM ('pending', 'approved', 'rejected', 'retracted');
    ELSE
        RAISE NOTICE 'Type "public.claim_status" already exists, skipping creation.';
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
        CREATE TYPE public.notification_type AS ENUM ('match_alert', 'claim_update', 'general_announcement');
    ELSE
        RAISE NOTICE 'Type "public.notification_type" already exists, skipping creation.';
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_status' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
        CREATE TYPE public.notification_status AS ENUM ('pending', 'sent', 'failed', 'read');
    ELSE
        RAISE NOTICE 'Type "public.notification_status" already exists, skipping creation.';
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
        CREATE TYPE public.user_role AS ENUM ('user', 'admin');
    ELSE
        RAISE NOTICE 'Type "public.user_role" already exists, skipping creation.';
    END IF;
END$$;

-- Function to automatically update 'updated_at' timestamp
CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
COMMENT ON FUNCTION public.trigger_set_timestamp() IS 'Automatically sets updated_at to current UTC timestamp on update.';

-- 2. Create 'profiles' Table
-- Stores public user data, extending Supabase's built-in 'auth.users' table.

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  role user_role DEFAULT 'user' NOT NULL,
  points INT DEFAULT 0 CHECK (points >= 0),
  contact_number TEXT UNIQUE,
  allow_sms_notifications BOOLEAN DEFAULT FALSE,
  allow_email_notifications BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 1) Add the role column (if you haven't yet):
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';

-- 2) Grant yourself admin rights:
UPDATE public.profiles
SET role = 'admin'
WHERE id = '632ecb48-c212-4d93-a529-847dc1dd6a80';

-- Alter the profiles table to change column types and add unique constraint
BEGIN;

-- Check if the mobile_number column exists before altering it
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='mobile_number') THEN
        -- Alter the existing mobile_number column type
        ALTER TABLE public.profiles
        ALTER COLUMN mobile_number TYPE TEXT USING mobile_number::TEXT;
    ELSE
        -- Add the mobile_number column if it doesn't exist
        ALTER TABLE public.profiles
        ADD COLUMN mobile_number TEXT NULL;
    END IF;
END $$;

-- Check if the physical_address column exists before altering it
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='physical_address') THEN
        -- Alter the existing physical_address column type
        ALTER TABLE public.profiles
        ALTER COLUMN physical_address TYPE TEXT USING physical_address::TEXT;
    ELSE
        -- Add the physical_address column if it doesn't exist
        ALTER TABLE public.profiles
        ADD COLUMN physical_address TEXT NULL;
    END IF;
END $$;

-- Check if the email column exists before altering it
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='email') THEN
        -- Alter the existing email column type
        ALTER TABLE public.profiles
        ALTER COLUMN email TYPE TEXT USING email::TEXT;
    END IF;
END $$;

-- Add a unique constraint to the mobile_number column if it doesn't already exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name='profiles' AND constraint_name='unique_mobile_number') THEN
        ALTER TABLE public.profiles
        ADD CONSTRAINT unique_mobile_number UNIQUE (mobile_number);
    END IF;
END $$;

COMMIT;

COMMENT ON TABLE public.profiles IS 'User profile information, extending auth.users.';
COMMENT ON COLUMN public.profiles.id IS 'User ID, references auth.users.id.';
COMMENT ON COLUMN public.profiles.points IS 'User points, e.g., for gamification or activity tracking.';
COMMENT ON COLUMN public.profiles.contact_number IS 'User phone number for SMS notifications (requires consent).';
COMMENT ON COLUMN public.profiles.mobile_number IS 'User mobile phone number for contact.';
COMMENT ON COLUMN public.profiles.physical_address IS 'User physical address for contact.';

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamp();

-- Create the categories table (replaces item_category ENUM)
CREATE TABLE IF NOT EXISTS public.categories (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);

COMMENT ON TABLE public.categories IS 'Stores item categories, replacing the old item_category ENUM.';

-- Populate the categories table
INSERT INTO public.categories (name) VALUES
('electronics'), ('apparel'), ('books'), ('stationery'),
('accessories'), ('documents'), ('ids_cards'), ('keys'), ('other')
ON CONFLICT (name) DO NOTHING;

-- Enable Row Level Security for 'categories' table
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories FORCE ROW LEVEL SECURITY; -- Ensures RLS applies even to table owners unless BYPASSRLS is used.

COMMENT ON TABLE public.categories IS 'Stores item categories. RLS is enabled to control access.';

-- RLS Policies for 'categories' table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE policyname = 'Authenticated users can view all categories'
        AND tablename = 'categories'
        AND schemaname = 'public'
    ) THEN
        CREATE POLICY "Authenticated users can view all categories" ON public.categories
            FOR SELECT
            TO authenticated -- Or TO public if you want anon users to also read them
            USING (true);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE policyname = 'Admins can manage categories'
        AND tablename = 'categories'
        AND schemaname = 'public'
    ) THEN
        CREATE POLICY "Admins can manage categories" ON public.categories
            FOR ALL -- Covers INSERT, UPDATE, DELETE
            TO authenticated -- Policy applies to authenticated users
            USING (public.is_admin(auth.uid())) -- Only admins can pass the USING condition
            WITH CHECK (public.is_admin(auth.uid())); -- Ensures new/modified rows also satisfy admin condition
    END IF;
END $$;

-- 3. Create 'items' Table
-- Stores information about lost or found items.

CREATE TABLE IF NOT EXISTS public.items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL CHECK (char_length(title) > 3 AND char_length(title) < 150), -- Adjusted min length for title
  description TEXT CHECK (char_length(description) < 1000),
  -- category_id will be added and managed below
  location_description TEXT NOT NULL CHECK (char_length(location_description) > 5 AND char_length(location_description) < 255),
  lat DOUBLE PRECISION CHECK (lat IS NULL OR (lat >= -90.0 AND lat <= 90.0)),
  lng DOUBLE PRECISION CHECK (lng IS NULL OR (lng >= -180.0 AND lng <= 180.0)),
  image_url TEXT,
  image_labels JSONB,
  image_caption TEXT, -- Added this from your previous script
  status item_status DEFAULT 'lost' NOT NULL, -- Uses item_status ENUM
  date_reported TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  date_lost_or_found TIMESTAMP WITH TIME ZONE NOT NULL,
  found_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_urgent BOOLEAN DEFAULT FALSE,
  document tsvector, -- For Full-Text Search
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT check_date_lost_or_found_before_reported CHECK (date_lost_or_found <= date_reported)
);

-- Add turn_in_to_security flag to items table
ALTER TABLE public.items
ADD COLUMN IF NOT EXISTS turn_in_to_security BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON TABLE public.items IS 'Stores details of lost or found items.';
COMMENT ON COLUMN public.items.user_id IS 'The user who initially reported this item.';
COMMENT ON COLUMN public.items.date_lost_or_found IS 'The actual date the item was lost or found by the person.';
COMMENT ON COLUMN public.items.image_labels IS 'JSON array of AI-detected object labels from the image.';
COMMENT ON COLUMN public.items.found_by_user_id IS 'User who found an item that was previously reported as lost, or an admin/system user facilitating this update.';
COMMENT ON COLUMN public.items.lat IS 'Latitude of the item location. Valid range: -90 to 90.';
COMMENT ON COLUMN public.items.lng IS 'Longitude of the item location. Valid range: -180 to 180.';
COMMENT ON COLUMN public.items.document IS 'Stores precomputed tsvector for Full-Text Search on title and description.';

-- Explicitly drop the old 'category' column (of ENUM type item_category) IF IT EXISTS.
-- This removes the dependency before trying to drop the ENUM type.
ALTER TABLE public.items DROP COLUMN IF EXISTS category;

-- Add the new category_id column (linking to categories table)
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS category_id INT;

-- If you have existing data in 'items' and category_id was just added,
-- you might need to populate it based on old 'category' values before dropping the old column/type,
-- or set a default for newly added NULL category_id columns.
-- Example: Populate category_id for existing rows IF 'category_id' is new and NULL,
-- and assuming 'other' is a safe default.
DO $$
DECLARE
    other_category_id INT;
BEGIN
    SELECT id INTO other_category_id FROM public.categories WHERE name = 'other';
    IF other_category_id IS NOT NULL THEN
        UPDATE public.items
        SET category_id = other_category_id
        WHERE category_id IS NULL; -- Only update if it's NULL (e.g., newly added column on existing table)
                                  -- OR if migrating from an old 'category' ENUM column, you'd map values here.
    ELSE
        RAISE WARNING 'Default category "other" not found in categories table. category_id might remain NULL for some rows.';
    END IF;
END $$;

-- Add the foreign key constraint for category_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_items_category' AND table_name = 'items' AND constraint_schema = 'public'
    ) THEN
        ALTER TABLE public.items
        ADD CONSTRAINT fk_items_category
        FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL; -- Or ON DELETE RESTRICT
    END IF;
END $$;

-- Make the category_id column NOT NULL.
-- Ensure all rows have a valid category_id before running this (the DO block above helps with defaults).
ALTER TABLE public.items ALTER COLUMN category_id SET NOT NULL;


-- Full-Text Search Trigger for 'items' table
DO $$
BEGIN
   IF NOT EXISTS (
       SELECT 1
       FROM pg_trigger
       WHERE tgname = 'tsvectorupdate_items_document' AND -- More specific trigger name
             tgrelid = 'public.items'::regclass
   ) THEN
      CREATE TRIGGER tsvectorupdate_items_document
      BEFORE INSERT OR UPDATE ON public.items
      FOR EACH ROW
      EXECUTE FUNCTION tsvector_update_trigger(document, 'pg_catalog.english', title, description);
      RAISE NOTICE 'Trigger "tsvectorupdate_items_document" on "public.items" created.';
   ELSE
      RAISE NOTICE 'Trigger "tsvectorupdate_items_document" on "public.items" already exists, skipping creation.';
   END IF;
END;
$$;

-- Update 'updated_at' Trigger for 'items' table
DROP TRIGGER IF EXISTS set_items_updated_at ON public.items;
CREATE TRIGGER set_items_updated_at
BEFORE UPDATE ON public.items
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamp();

-- Now that the 'category' column (which used item_category ENUM) is definitively dropped from 'items',
-- we can safely drop the item_category ENUM type.
DROP TYPE IF EXISTS public.item_category; -- This should now work.


-- 4. Create 'claims' Table
CREATE TABLE IF NOT EXISTS public.claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  claimer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  claim_description TEXT NOT NULL CHECK (char_length(claim_description) > 10 AND char_length(claim_description) < 1000),
  status claim_status DEFAULT 'pending' NOT NULL,
  date_claimed TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  date_resolved TIMESTAMP WITH TIME ZONE,
  resolved_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT check_date_resolved_after_claimed CHECK (date_resolved IS NULL OR date_resolved >= date_claimed)
);

-- Add turn_in_to_security flag to claims table
ALTER TABLE public.claims
ADD COLUMN IF NOT EXISTS turn_in_to_security BOOLEAN NOT NULL DEFAULT FALSE;





COMMENT ON TABLE public.claims IS 'Manages claims made by users for items. Consider application-level logic or a trigger to prevent users from claiming items they themselves reported.';
COMMENT ON COLUMN public.claims.resolved_by_user_id IS 'User (reporter or admin) who resolved the claim.';

DROP TRIGGER IF EXISTS set_claims_updated_at ON public.claims;
CREATE TRIGGER set_claims_updated_at
BEFORE UPDATE ON public.claims
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamp();


-- 5. Create 'notifications' Table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.items(id) ON DELETE SET NULL,
  claim_id UUID REFERENCES public.claims(id) ON DELETE SET NULL,
  type notification_type NOT NULL,
  title TEXT NOT NULL CHECK (char_length(title) > 3 AND char_length(title) < 100),
  message TEXT NOT NULL CHECK (char_length(message) > 5 AND char_length(message) < 500),
  status notification_status DEFAULT 'pending' NOT NULL,
  via TEXT CHECK (via IN ('email', 'sms', 'in_app')),
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE
);
COMMENT ON TABLE public.notifications IS 'Stores system and user-triggered notifications.';
COMMENT ON COLUMN public.notifications.read_at IS 'Timestamp when the user marked the notification as read.';


-- 6. Create Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_points ON public.profiles(points DESC);

CREATE INDEX IF NOT EXISTS idx_items_user_id ON public.items(user_id);
CREATE INDEX IF NOT EXISTS idx_items_status ON public.items(status);
-- Corrected indexes for category_id:
DROP INDEX IF EXISTS public.idx_category; -- If this old index name was used
DROP INDEX IF EXISTS public.idx_items_category; -- If this old index on ENUM column was used
CREATE INDEX IF NOT EXISTS idx_items_category_id ON public.items (category_id);
CREATE INDEX IF NOT EXISTS idx_items_category_id_date_lost_or_found ON public.items (category_id, date_lost_or_found DESC); -- Combined and ordered
CREATE INDEX IF NOT EXISTS idx_items_date_lost_or_found ON public.items(date_lost_or_found DESC);
CREATE INDEX IF NOT EXISTS idx_items_image_labels ON public.items USING GIN (image_labels);
CREATE INDEX IF NOT EXISTS idx_items_title ON public.items (title); -- From your script
CREATE INDEX IF NOT EXISTS idx_fts_document ON public.items USING GIN (document); -- For FTS

CREATE INDEX IF NOT EXISTS idx_claims_item_id ON public.claims(item_id);
CREATE INDEX IF NOT EXISTS idx_claims_claimer_id ON public.claims(claimer_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON public.claims(status);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id_status ON public.notifications(user_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_read_at_created_at ON public.notifications(user_id, read_at NULLS FIRST, created_at DESC);


-- 7. Create Function to Handle New User (Auto-create profile)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, allow_email_notifications)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    TRUE
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
COMMENT ON FUNCTION public.handle_new_user() IS 'Trigger function to create a user profile upon new auth.users entry. Assumes full_name and avatar_url might be in raw_user_meta_data.';

-- 8. Create Trigger to Call handle_new_user Function
DO $$
BEGIN
   IF NOT EXISTS (
       SELECT 1
       FROM pg_trigger
       WHERE tgname = 'on_auth_user_created' AND
             tgrelid = 'auth.users'::regclass
   ) THEN
      CREATE TRIGGER on_auth_user_created
        AFTER INSERT ON auth.users
        FOR EACH ROW
        EXECUTE FUNCTION public.handle_new_user();
      RAISE NOTICE 'Trigger "on_auth_user_created" on "auth.users" created.';
   ELSE
      RAISE NOTICE 'Trigger "on_auth_user_created" on "auth.users" already exists, skipping creation.';
   END IF;
END;
$$;

-- 9. Create Helper Function for RLS (is_admin)
CREATE OR REPLACE FUNCTION public.is_admin(user_id_to_check UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = user_id_to_check AND p.role = 'admin'
  );
END;
$$;
COMMENT ON FUNCTION public.is_admin(UUID) IS 'Checks if the given user_id has an admin role in their profile.';


-- 10. Enable Row Level Security (RLS) for all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 11. Define RLS Policies (Idempotent)

-- Profiles Table RLS (Your existing idempotent policies are good, keeping them as is)
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view all profiles' AND tablename = 'profiles' AND schemaname = 'public') THEN CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (auth.role() = 'authenticated'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert their own profile' AND tablename = 'profiles' AND schemaname = 'public') THEN CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their own profile' AND tablename = 'profiles' AND schemaname = 'public') THEN CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage all profiles' AND tablename = 'profiles' AND schemaname = 'public') THEN CREATE POLICY "Admins can manage all profiles" ON public.profiles FOR ALL USING (public.is_admin(auth.uid())); END IF; END $$;

-- Items Table RLS (Your existing idempotent policies are good)
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can view all items' AND tablename = 'items' AND schemaname = 'public') THEN CREATE POLICY "Authenticated users can view all items" ON public.items FOR SELECT USING (auth.role() = 'authenticated'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert items for themselves' AND tablename = 'items' AND schemaname = 'public') THEN CREATE POLICY "Users can insert items for themselves" ON public.items FOR INSERT WITH CHECK (auth.uid() = user_id); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their own reported items' AND tablename = 'items' AND schemaname = 'public') THEN CREATE POLICY "Users can update their own reported items" ON public.items FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete their own reported items (if not claimed/archived)' AND tablename = 'items' AND schemaname = 'public') THEN CREATE POLICY "Users can delete their own reported items (if not claimed/archived)" ON public.items FOR DELETE USING (auth.uid() = user_id AND status NOT IN ('claimed', 'archived')); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage all items' AND tablename = 'items' AND schemaname = 'public') THEN CREATE POLICY "Admins can manage all items" ON public.items FOR ALL USING (public.is_admin(auth.uid())); END IF; END $$;

-- Claims Table RLS (Your existing idempotent policies are good)
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can create claims for items' AND tablename = 'claims' AND schemaname = 'public') THEN CREATE POLICY "Users can create claims for items" ON public.claims FOR INSERT WITH CHECK (auth.uid() = claimer_id); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own claims' AND tablename = 'claims' AND schemaname = 'public') THEN CREATE POLICY "Users can view their own claims" ON public.claims FOR SELECT USING (auth.uid() = claimer_id); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Item reporters can view claims on their items' AND tablename = 'claims' AND schemaname = 'public') THEN CREATE POLICY "Item reporters can view claims on their items" ON public.claims FOR SELECT USING (EXISTS ( SELECT 1 FROM public.items i WHERE i.id = claims.item_id AND i.user_id = auth.uid() )); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Item reporters or Admins can update claims on items' AND tablename = 'claims' AND schemaname = 'public') THEN CREATE POLICY "Item reporters or Admins can update claims on items" ON public.claims FOR UPDATE USING ( (EXISTS (SELECT 1 FROM public.items i WHERE i.id = claims.item_id AND i.user_id = auth.uid())) OR public.is_admin(auth.uid()) ) WITH CHECK ( (EXISTS (SELECT 1 FROM public.items i WHERE i.id = claims.item_id AND i.user_id = auth.uid())) OR public.is_admin(auth.uid()) ); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Claimers can retract their PENDING claims' AND tablename = 'claims' AND schemaname = 'public') THEN CREATE POLICY "Claimers can retract their PENDING claims" ON public.claims FOR UPDATE USING (auth.uid() = claimer_id AND status = 'pending') WITH CHECK (status = 'retracted'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage all claims' AND tablename = 'claims' AND schemaname = 'public') THEN CREATE POLICY "Admins can manage all claims" ON public.claims FOR ALL USING (public.is_admin(auth.uid())); END IF; END $$;

-- Notifications Table RLS (Your existing idempotent policies are good)
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own notifications' AND tablename = 'notifications' AND schemaname = 'public') THEN CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can mark their own notifications (e.g. as read)' AND tablename = 'notifications' AND schemaname = 'public') THEN CREATE POLICY "Users can mark their own notifications (e.g. as read)" ON public.notifications FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage all notifications' AND tablename = 'notifications' AND schemaname = 'public') THEN CREATE POLICY "Admins can manage all notifications" ON public.notifications FOR ALL USING (public.is_admin(auth.uid())); END IF; END $$;

-- 13. Create conversations and messages tables for chat feature

-- Note: Ensure the uuid-ossp extension is enabled:
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- Create enum for conversation type
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'conversation_type' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
        CREATE TYPE public.conversation_type AS ENUM ('user-to-poster', 'user-to-security');
    ELSE
        RAISE NOTICE 'Type "public.conversation_type" already exists, skipping creation.';
    END IF;
END$$;

-- Create conversations table
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID REFERENCES public.items(id) ON DELETE CASCADE NOT NULL,
    creator_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    type public.conversation_type NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- This DO block attempts to bring an older 'conversations' table (if it exists and is missing columns/constraints)
-- closer to the definition above.
DO $$
BEGIN
    RAISE NOTICE 'Checking and patching "public.conversations" table if necessary...';

    -- --- Handle 'creator_id' column ---
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='conversations' AND column_name='creator_id' AND table_schema='public') THEN
        RAISE NOTICE 'Column "creator_id" not found in "public.conversations". Adding it.';
        ALTER TABLE public.conversations ADD COLUMN creator_id UUID;
        -- If column was just added, all existing rows will have NULL for creator_id.
        -- Attempt to populate from linked item's user_id.
        RAISE NOTICE 'Attempting to populate newly added NULL creator_id in "public.conversations" from linked items.user_id.';
        UPDATE public.conversations c
        SET creator_id = i.user_id
        FROM public.items i
        WHERE c.item_id = i.id AND c.creator_id IS NULL AND i.user_id IS NOT NULL;
    ELSE
        -- Column exists, check if there are any NULLs that need populating
        IF EXISTS (SELECT 1 FROM public.conversations WHERE creator_id IS NULL) THEN
            RAISE NOTICE 'Found NULL creator_id values in existing "public.conversations" column. Attempting to populate from linked items.user_id.';
            UPDATE public.conversations c
            SET creator_id = i.user_id
            FROM public.items i
            WHERE c.item_id = i.id AND c.creator_id IS NULL AND i.user_id IS NOT NULL;
        END IF;
    END IF;

    -- After attempting to populate, check if any NULLs remain for creator_id
    IF EXISTS (SELECT 1 FROM public.conversations WHERE creator_id IS NULL) THEN
        RAISE WARNING 'WARNING: Some rows in "public.conversations" still have NULL for "creator_id" after attempting to populate from item.user_id. The following "ALTER TABLE ... SET NOT NULL" for "creator_id" will LIKELY FAIL. Manual data correction is required for these rows, or you may need to temporarily make "creator_id" nullable in the table definition if this is acceptable.';
        -- You can find problematic rows with: SELECT id, item_id FROM public.conversations WHERE creator_id IS NULL;
    END IF;

    -- Attempt to apply the NOT NULL constraint for creator_id
    RAISE NOTICE 'Attempting to set "creator_id" to NOT NULL in "public.conversations".';
    ALTER TABLE public.conversations ALTER COLUMN creator_id SET NOT NULL;

    -- Ensure Foreign Key for creator_id exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'conversations' AND constraint_name = 'conversations_creator_id_fkey' AND constraint_schema = 'public'
    ) THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='conversations' AND column_name='creator_id' AND table_schema='public') THEN
             RAISE NOTICE 'Adding Foreign Key constraint "conversations_creator_id_fkey" to "public.conversations".';
             ALTER TABLE public.conversations
             ADD CONSTRAINT conversations_creator_id_fkey
             FOREIGN KEY (creator_id) REFERENCES auth.users(id) ON DELETE CASCADE;
        END IF;
    END IF;

    -- --- Handle 'updated_at' column ---
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='conversations' AND column_name='updated_at' AND table_schema='public') THEN
        RAISE NOTICE 'Column "updated_at" not found in "public.conversations". Adding it.';
        ALTER TABLE public.conversations ADD COLUMN updated_at TIMESTAMPTZ;
    END IF;
    -- Populate NULL updated_at values before setting NOT NULL. Use created_at or current time as fallback.
    RAISE NOTICE 'Populating NULL "updated_at" for existing rows in "public.conversations" using "created_at" or current time.';
    UPDATE public.conversations SET updated_at = COALESCE(created_at, timezone('utc'::text, now())) WHERE updated_at IS NULL;

    RAISE NOTICE 'Setting DEFAULT and NOT NULL for "updated_at" in "public.conversations".';
    ALTER TABLE public.conversations
        ALTER COLUMN updated_at SET DEFAULT timezone('utc'::text, now()),
        ALTER COLUMN updated_at SET NOT NULL;


    -- --- Handle 'type' column NOT NULL constraint ---
    -- (Assuming 'type' column itself would exist if 'conversations' table exists, as it's not marked "-- Added".
    -- If 'type' could also be missing, a similar ADD COLUMN block would be needed for it.)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='conversations' AND column_name='type' AND table_schema='public') THEN
       -- If 'type' could have NULLs from an older schema version, populate them first.
       -- For example, defaulting to 'user-to-poster' if that's a sensible default.
       -- IF EXISTS (SELECT 1 FROM public.conversations WHERE type IS NULL) THEN
       --    RAISE NOTICE 'Populating NULL "type" in "public.conversations" with a default value (e.g., ''user-to-poster'').';
       --    UPDATE public.conversations SET type = 'user-to-poster' WHERE type IS NULL;
       -- END IF;
       RAISE NOTICE 'Setting NOT NULL for "type" in "public.conversations".';
       ALTER TABLE public.conversations ALTER COLUMN type SET NOT NULL;
    END IF;

    RAISE NOTICE '"public.conversations" table check and patch complete.';
END $$;

-- Deduplicate conversations before creating the unique index
DO $$
DECLARE
    v_deleted_count INTEGER := 0;
    v_total_deleted_count INTEGER := 0;
    rec RECORD;
    curs CURSOR FOR
        SELECT item_id, creator_id, type, array_agg(id ORDER BY created_at ASC, id ASC) as ids, COUNT(*) as count
        FROM public.conversations
        GROUP BY item_id, creator_id, type
        HAVING COUNT(*) > 1;
    id_to_keep UUID;
    ids_to_delete UUID[];
BEGIN
    RAISE NOTICE 'DEDUPLICATION: Checking for duplicate conversations before creating unique index idx_conversations_item_creator_type_unique...';

    FOR rec IN curs LOOP
        RAISE NOTICE 'DEDUPLICATION: Found group with duplicates - item_id: %, creator_id: %, type: %, count: %', rec.item_id, rec.creator_id, rec.type, rec.count;

        id_to_keep := rec.ids[1]; -- First element is the one to keep (earliest created_at, then smallest id)
        ids_to_delete := rec.ids[2:array_length(rec.ids, 1)]; -- Rest are to be deleted

        RAISE NOTICE 'DEDUPLICATION: Keeping id: %. Attempting to delete % other ids for this group.', id_to_keep, array_length(ids_to_delete, 1);

        IF array_length(ids_to_delete, 1) > 0 THEN
            DELETE FROM public.conversations
            WHERE id = ANY(ids_to_delete);
            GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
            v_total_deleted_count := v_total_deleted_count + v_deleted_count;
            RAISE NOTICE 'DEDUPLICATION: Deleted % rows for this group.', v_deleted_count;
        ELSE
            RAISE NOTICE 'DEDUPLICATION: No rows to delete for this group (should not happen if count > 1 and ids_to_delete was populated).';
        END IF;
    END LOOP;

    IF v_total_deleted_count > 0 THEN
        RAISE NOTICE 'DEDUPLICATION: Process complete. Total % duplicate rows deleted.', v_total_deleted_count;
    ELSE
        RAISE NOTICE 'DEDUPLICATION: No duplicate conversations found that required removal.';
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'DEDUPLICATION: An error occurred during conversation deduplication: % - %', SQLSTATE, SQLERRM;
END $$;

-- Add indexes for conversations table
CREATE INDEX IF NOT EXISTS idx_conversations_item_id ON public.conversations(item_id);
CREATE INDEX IF NOT EXISTS idx_conversations_creator_id ON public.conversations(creator_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_item_creator_type_unique ON public.conversations(item_id, creator_id, type);


-- Create messages table
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
    sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    body TEXT,
    attachments JSONB[], -- Array of JSON objects, e.g., { "url": "...", "type": "image/jpeg", "name": "..." }
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT check_body_or_attachments CHECK (body IS NOT NULL OR (attachments IS NOT NULL AND jsonb_array_length(attachments) > 0))
);

-- Function to update conversation's updated_at when a new message is inserted
CREATE OR REPLACE FUNCTION public.update_conversation_updated_at_on_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.conversations
    SET updated_at = timezone('utc'::text, now())
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update conversation's updated_at when a new message is inserted
DROP TRIGGER IF EXISTS trigger_update_conversation_updated_at_on_new_message ON public.messages;
CREATE TRIGGER trigger_update_conversation_updated_at_on_new_message
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.update_conversation_updated_at_on_message();


-- Helper function to check if the current user is a security admin
CREATE OR REPLACE FUNCTION public.get_user_is_security_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (SELECT auth.user_metadata()->>'is_security_admin')::BOOLEAN = TRUE;
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies for conversations table
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow users to create their own conversations" ON public.conversations;
CREATE POLICY "Allow users to create their own conversations"
ON public.conversations
FOR INSERT
TO authenticated
WITH CHECK (public.conversations.creator_id = auth.uid());

DROP POLICY IF EXISTS "Allow participants to view conversations" ON public.conversations;
CREATE POLICY "Allow participants to view conversations"
ON public.conversations
FOR SELECT
TO authenticated
USING (
  public.conversations.creator_id = auth.uid() OR
  (
    type = 'user-to-poster' AND
    EXISTS (
      SELECT 1 FROM public.items i
      WHERE i.id = public.conversations.item_id AND i.user_id = auth.uid()
    )
  ) OR
  (
    type = 'user-to-security' AND
    (public.conversations.creator_id = auth.uid() OR public.get_user_is_security_admin())
  )
);

DROP POLICY IF EXISTS "Allow participants to update conversations" ON public.conversations;
CREATE POLICY "Allow participants to update conversations"
ON public.conversations
FOR UPDATE
TO authenticated
USING (
  public.conversations.creator_id = auth.uid() OR
  (
    type = 'user-to-poster' AND
    EXISTS (
      SELECT 1 FROM public.items i
      WHERE i.id = public.conversations.item_id AND i.user_id = auth.uid()
    )
  ) OR -- Combine with user-to-security condition
  (
    type = 'user-to-security' AND
    (public.conversations.creator_id = auth.uid() OR public.get_user_is_security_admin())
  )
)
WITH CHECK (true);  -- Allow any updates as long as the USING clause is satisfied

-- Policy to allow conversation creators to delete their conversations
DROP POLICY IF EXISTS "Allow creators to delete their conversations" ON public.conversations;
CREATE POLICY "Allow creators to delete their conversations"
ON public.conversations
FOR DELETE
TO authenticated
USING (public.conversations.creator_id = auth.uid());


-- RLS Policies for messages table
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow users to send messages in their conversations" ON public.messages;
CREATE POLICY "Allow users to send messages in their conversations"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid() AND 
  EXISTS ( 
    SELECT 1 FROM public.conversations c
    WHERE c.id = messages.conversation_id AND
    (
      c.creator_id = auth.uid() OR
      (
        c.type = 'user-to-poster' AND
        EXISTS (
          SELECT 1 FROM public.items i
          WHERE i.id = c.item_id AND i.user_id = auth.uid()
        )
      ) OR
      (
        c.type = 'user-to-security' AND
        (c.creator_id = auth.uid() OR public.get_user_is_security_admin()) 
      )
    )
  )
);

DROP POLICY IF EXISTS "Allow participants to view messages in their conversations" ON public.messages;
CREATE POLICY "Allow participants to view messages in their conversations"
ON public.messages
FOR SELECT
TO authenticated
USING (
  EXISTS ( 
    SELECT 1 FROM public.conversations c
    WHERE c.id = messages.conversation_id AND
    (
      c.creator_id = auth.uid() OR
      (
        c.type = 'user-to-poster' AND
        EXISTS (
          SELECT 1 FROM public.items i
          WHERE i.id = c.item_id AND i.user_id = auth.uid()
        )
      ) OR
      (
        c.type = 'user-to-security' AND
        (c.creator_id = auth.uid() OR public.get_user_is_security_admin())
      )
    )
  )
);

-- Enable Realtime for conversations and messages
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables pt
        WHERE pt.pubname = 'supabase_realtime' AND pt.schemaname = 'public' AND pt.tablename = 'messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    END IF;
  ELSE
    RAISE NOTICE 'Publication supabase_realtime does not exist. Creating it for public.messages.';
    CREATE PUBLICATION supabase_realtime FOR TABLE public.messages;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables pt
        WHERE pt.pubname = 'supabase_realtime' AND pt.schemaname = 'public' AND pt.tablename = 'conversations'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
    END IF;
  ELSE
    RAISE NOTICE 'Publication supabase_realtime does not exist. Creating it for public.conversations.';
    CREATE PUBLICATION supabase_realtime FOR TABLE public.conversations;
  END IF;
END $$;

-- (The rest of your schema script continues)



-- IMPORTANT NOTE on 'user-to-security' RLS:
-- The current policies for 'user-to-security' type conversations only allow the creator of the conversation
-- to interact with it. The "security personnel" side of this interaction is not yet enabled by these RLS rules.
-- This will need to be addressed by defining how security personnel are identified (e.g., a specific role,
-- a custom claim, or a separate table of security user IDs) and updating the RLS policies accordingly.
-- For example, replacing `creator_id = auth.uid()` in the 'user-to-security' OR blocks with
-- `(creator_id = auth.uid() OR is_security_admin(auth.uid()))` where `is_security_admin` is a custom SQL function.

-- 14. Policies for the 'avatars' Supabase Storage bucket
-- These policies ensure that authenticated users can only upload, update, and delete files
-- within a folder named after their own user ID inside the 'avatars' bucket.
-- To apply these, go to your Supabase Dashboard -> SQL Editor and run the script.

-- Policy to allow authenticated users to upload (INSERT) files
-- only if the file path is in their user ID folder within the 'avatars' bucket.
-- Drop the existing policy if it exists
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;


-- Create the policy to allow authenticated users to upload their own avatar
CREATE POLICY "Users can upload their own avatar"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy to allow authenticated users to update (UPDATE) files
-- only if the file path is in their user ID folder within the 'avatars' bucket.
create policy "Users can update their own avatar"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy to allow authenticated users to delete (DELETE) files
-- only if the file path is in their user ID folder within the 'avatars' bucket.
create policy "Users can delete their own avatar"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Optional: Policy to allow anyone to view avatars (SELECT) from the 'avatars' bucket.
-- If you want avatars to be publicly viewable, add this policy.
-- If you only want logged-in users to see avatars, change 'public' to 'authenticated'.
create policy "Anyone can view avatars"
on storage.objects
for select
to public  -- Change to 'authenticated' if only logged-in users should see avatars
using (
  bucket_id = 'avatars'
);



-- 15. Guidance for Supabase Storage Buckets (Manual setup in Dashboard)
-- Reminder:
--   - Bucket name: 'item-images' (lowercase, hyphens allowed)
--   - RLS for 'item-images' INSERT: (bucket_id = 'item-images'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)
--   - RLS for 'item-images' SELECT (if public): (bucket_id = 'item-images'::text)
--   - Similarly for 'avatars' bucket if you create one.

--RAISE NOTICE 'Schema script executed successfully.';
-- End of Schema Script

-- Add this section to enable RLS and define the SELECT policy for the messages table

-- Ensure RLS is enabled for the messages table if it's not already
-- This command can be run multiple times without issue.
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Drop the policy if it already exists to avoid errors when rerunning the script
-- This is useful for development environments where you might rerun the script often.
-- In production, you might manage policy updates differently.
DROP POLICY IF EXISTS "Allow authenticated users to read/subscribe to their conversation messages" ON public.messages;

-- Then, create the policy.
-- This policy allows authenticated users to read/subscribe to messages
-- if they are a participant in the conversation (either the creator or
-- the owner of the item associated with the conversation).
CREATE POLICY "Allow authenticated users to read/subscribe to their conversation messages"
ON public.messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.conversations
    WHERE
      conversations.id = messages.conversation_id
      AND (
        conversations.creator_id = auth.uid()
        OR conversations.item_id IN (
          SELECT items.id
          FROM public.items
          WHERE
            items.id = conversations.item_id
            AND items.user_id = auth.uid()
        )
      )
  )
);

-- Optional: Add an INSERT policy if you are also having issues sending messages due to RLS
-- DROP POLICY IF EXISTS "Allow authenticated users to send messages in their conversations" ON public.messages;
-- CREATE POLICY "Allow authenticated users to send messages in their conversations"
-- ON public.messages
-- FOR INSERT
-- TO authenticated
-- WITH CHECK (
--   EXISTS (
--     SELECT 1
--     FROM public.conversations
--     WHERE
--       conversations.id = messages.conversation_id
--       AND (
--         conversations.creator_id = auth.uid()
--         OR conversations.item_id IN (
--           SELECT items.id
--           FROM public.items
--           WHERE
--             items.id = conversations.item_id
--             AND items.user_id = auth.uid()
--         )
--       )
--   )
-- );