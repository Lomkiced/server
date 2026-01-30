-- =====================================================
-- Migration: Seed Sub-Offices for ORD
-- =====================================================

DO $$ 
DECLARE
    ord_office_id INTEGER;
BEGIN
    -- Find the ORD office for each region
    FOR ord_office_id IN 
        SELECT office_id FROM public.offices WHERE code = 'ORD'
    LOOP
        INSERT INTO public.sub_units (office_id, name, description) VALUES
        (ord_office_id, 'DRRM', 'Disaster Risk Reduction and Management'),
        (ord_office_id, 'ITSM', 'Information Technology Services Management'),
        (ord_office_id, 'HR', 'Human Resources'),
        (ord_office_id, 'Finance', 'Finance and Accounting')
        ON CONFLICT (office_id, name) DO NOTHING;
    END LOOP;
END $$;

-- Verify seeding
SELECT su.sub_unit_id, su.name, o.code as office_code, r.name as region
FROM sub_units su
JOIN offices o ON su.office_id = o.office_id
JOIN regions r ON o.region_id = r.id
ORDER BY r.name, o.code, su.name;
