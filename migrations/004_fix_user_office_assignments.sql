-- =====================================================
-- Migration: Fix User Office Assignments
-- This fixes the schema to store office_ids instead of sub_unit_ids
-- =====================================================

-- 1. Drop the old constraint-problematic table
DROP TABLE IF EXISTS public.user_sub_units CASCADE;

-- 2. Create new table for user office assignments (no FK to sub_units)
CREATE TABLE IF NOT EXISTS public.user_office_assignments (
    assignment_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES public.users(user_id) ON DELETE CASCADE,
    office_id INTEGER REFERENCES public.offices(office_id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, office_id) -- Prevent duplicate assignments
);

-- 3. Recreate user_sub_units as a view for backward compatibility
-- This allows old code to work while we transition
CREATE OR REPLACE VIEW public.user_sub_units AS
SELECT 
    assignment_id,
    user_id,
    office_id as sub_unit_id, -- Alias for backward compatibility
    created_at
FROM public.user_office_assignments;

-- 4. Create insert rule for the view
CREATE OR REPLACE RULE user_sub_units_insert AS
ON INSERT TO public.user_sub_units
DO INSTEAD
INSERT INTO public.user_office_assignments (user_id, office_id)
VALUES (NEW.user_id, NEW.sub_unit_id)
ON CONFLICT (user_id, office_id) DO NOTHING;

-- 5. Create delete rule for the view
CREATE OR REPLACE RULE user_sub_units_delete AS
ON DELETE TO public.user_sub_units
DO INSTEAD
DELETE FROM public.user_office_assignments 
WHERE user_id = OLD.user_id AND office_id = OLD.sub_unit_id;
