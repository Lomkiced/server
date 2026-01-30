-- =====================================================
-- Migration: Add Sub-Units Support (Many-to-Many)
-- =====================================================

-- 1. Create sub_units table
CREATE TABLE IF NOT EXISTS public.sub_units (
    sub_unit_id SERIAL PRIMARY KEY,
    office_id INTEGER REFERENCES public.offices(office_id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(office_id, name)
);

-- 2. Create Junction Table for Many-to-Many
CREATE TABLE IF NOT EXISTS public.user_sub_units (
    assignment_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES public.users(user_id) ON DELETE CASCADE,
    sub_unit_id INTEGER REFERENCES public.sub_units(sub_unit_id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, sub_unit_id) -- Prevent duplicate assignments
);

-- 3. Cleanup: Remove old single-column if it exists (from previous attempt)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='sub_unit_id') THEN
        ALTER TABLE public.users DROP COLUMN sub_unit_id;
    END IF;
END $$;

-- 4. Seed Initial Sub-Units
DO $$ 
DECLARE
    it_office_id INTEGER;
BEGIN
    SELECT office_id INTO it_office_id FROM public.offices WHERE name LIKE '%Information Technology%' LIMIT 1;
    
    IF it_office_id IS NOT NULL THEN
        INSERT INTO public.sub_units (office_id, name, description) VALUES
        (it_office_id, 'Software Development', 'App dev team'),
        (it_office_id, 'Network Administration', 'Infra team'),
        (it_office_id, 'Technical Support', 'Helpdesk')
        ON CONFLICT (office_id, name) DO NOTHING;
    END IF;
END $$;
