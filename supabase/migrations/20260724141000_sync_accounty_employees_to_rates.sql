-- Create sync trigger function to sync accounty_employees with employee_rates
CREATE OR REPLACE FUNCTION sync_accounty_employee_to_rates()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Insert a new rate row if name doesn't exist for the company
        IF NOT EXISTS (
            SELECT 1 FROM employee_rates 
            WHERE company_id = NEW.company_id 
              AND employee_name = (NEW.last_name || ' ' || NEW.first_name)
        ) THEN
            INSERT INTO employee_rates (
                company_id,
                employee_name,
                employee_type,
                effective_date,
                email,
                phone,
                created_at,
                updated_at
            )
            VALUES (
                NEW.company_id,
                NEW.last_name || ' ' || NEW.first_name,
                'employee',
                CURRENT_DATE,
                NEW.email,
                NEW.phone,
                NOW(),
                NOW()
            );
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Update name, email, phone if they changed
        IF (OLD.last_name <> NEW.last_name OR OLD.first_name <> NEW.first_name OR COALESCE(OLD.email, '') <> COALESCE(NEW.email, '') OR COALESCE(OLD.phone, '') <> COALESCE(NEW.phone, '')) THEN
            UPDATE employee_rates
            SET 
                employee_name = NEW.last_name || ' ' || NEW.first_name,
                email = NEW.email,
                phone = NEW.phone,
                updated_at = NOW()
            WHERE company_id = NEW.company_id
              AND employee_name = (OLD.last_name || ' ' || OLD.first_name);
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        -- Delete matching rate row
        DELETE FROM employee_rates
        WHERE company_id = OLD.company_id
          AND employee_name = (OLD.last_name || ' ' || OLD.first_name);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS trg_sync_accounty_employee_to_rates ON accounty_employees;
CREATE TRIGGER trg_sync_accounty_employee_to_rates
AFTER INSERT OR UPDATE OR DELETE ON accounty_employees
FOR EACH ROW EXECUTE FUNCTION sync_accounty_employee_to_rates();

-- Backfill all existing employees from accounty_employees into employee_rates
INSERT INTO employee_rates (
    company_id,
    employee_name,
    employee_type,
    effective_date,
    email,
    phone,
    created_at,
    updated_at
)
SELECT 
    e.company_id,
    e.last_name || ' ' || e.first_name,
    'employee',
    CURRENT_DATE,
    e.email,
    e.phone,
    NOW(),
    NOW()
FROM accounty_employees e
WHERE NOT EXISTS (
    SELECT 1 FROM employee_rates r
    WHERE r.company_id = e.company_id
      AND r.employee_name = (e.last_name || ' ' || e.first_name)
);
