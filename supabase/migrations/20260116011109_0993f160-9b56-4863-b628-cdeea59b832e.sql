-- Fix existing sequences that have NULL created_by
-- Assign them to the first user (owner of the system)
UPDATE email_sequences 
SET created_by = 'c77aa9b4-9fab-4e2c-8588-9c161daae910'
WHERE created_by IS NULL;