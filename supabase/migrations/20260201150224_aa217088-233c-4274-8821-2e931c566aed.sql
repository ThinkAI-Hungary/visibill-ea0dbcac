-- Add unique constraint on alias_email (only for non-empty values)
CREATE UNIQUE INDEX IF NOT EXISTS email_aliases_alias_email_unique 
ON email_aliases (alias_email) 
WHERE alias_email IS NOT NULL AND alias_email != '';