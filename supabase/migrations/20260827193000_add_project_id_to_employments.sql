-- Migration: Add project_id to accounty_employments and employee_rates
-- Date: 2026-08-27

-- 1. Add project_id columns referencing public.projects(id)
ALTER TABLE public.accounty_employments 
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

ALTER TABLE public.employee_rates 
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.accounty_employments.project_id IS 'A foglalkoztatott jogviszonyához rendelt projekt';
COMMENT ON COLUMN public.employee_rates.project_id IS 'A dolgozóhoz/alvállalkozóhoz rendelt projekt';

-- 2. Update the sync trigger function to propagate project_id updates
CREATE OR REPLACE FUNCTION sync_accounty_employment_to_rates()
RETURNS TRIGGER AS $$
DECLARE
    v_employee_name TEXT;
    v_hourly_rate NUMERIC;
BEGIN
    -- Get the employee's name
    SELECT last_name || ' ' || first_name INTO v_employee_name
    FROM accounty_employees
    WHERE id = NEW.employee_id;

    IF v_employee_name IS NOT NULL THEN
        -- Calculate a default hourly rate if base_salary and weekly_hours are present
        IF NEW.base_salary IS NOT NULL AND NEW.weekly_hours IS NOT NULL AND NEW.weekly_hours > 0 THEN
            v_hourly_rate := ROUND(NEW.base_salary / (NEW.weekly_hours * 4.333));
        ELSE
            v_hourly_rate := NULL;
        END IF;

        -- Update the rate card if it exists, including project_id sync
        UPDATE employee_rates
        SET 
            base_salary_cost = NEW.base_salary,
            hourly_rate = COALESCE(v_hourly_rate, hourly_rate),
            project_id = NEW.project_id,
            updated_at = NOW()
        WHERE company_id = NEW.company_id
          AND employee_name = v_employee_name;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Backfill active employments project_id value if any exist (safety step)
UPDATE employee_rates r
SET 
    project_id = emp.project_id,
    updated_at = NOW()
FROM accounty_employees e
JOIN accounty_employments emp ON emp.employee_id = e.id AND emp.status = 'active'
WHERE r.company_id = e.company_id
  AND r.employee_name = (e.last_name || ' ' || e.first_name)
  AND emp.project_id IS NOT NULL;
