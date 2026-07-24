-- Create sync trigger function to sync accounty_employments with employee_rates
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

        -- Update the rate card if it exists
        UPDATE employee_rates
        SET 
            base_salary_cost = NEW.base_salary,
            hourly_rate = COALESCE(v_hourly_rate, hourly_rate),
            updated_at = NOW()
        WHERE company_id = NEW.company_id
          AND employee_name = v_employee_name;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on accounty_employments
DROP TRIGGER IF EXISTS trg_sync_accounty_employment_to_rates ON accounty_employments;
CREATE TRIGGER trg_sync_accounty_employment_to_rates
AFTER INSERT OR UPDATE ON accounty_employments
FOR EACH ROW EXECUTE FUNCTION sync_accounty_employment_to_rates();

-- Backfill existing employments to employee_rates
UPDATE employee_rates r
SET 
    base_salary_cost = emp.base_salary,
    hourly_rate = ROUND(emp.base_salary / (emp.weekly_hours * 4.333)),
    updated_at = NOW()
FROM accounty_employees e
JOIN accounty_employments emp ON emp.employee_id = e.id AND emp.status = 'active'
WHERE r.company_id = e.company_id
  AND r.employee_name = (e.last_name || ' ' || e.first_name)
  AND emp.base_salary IS NOT NULL
  AND emp.weekly_hours IS NOT NULL
  AND emp.weekly_hours > 0;
