-- Update from_email for SMTP connection
UPDATE crm_connections 
SET from_email = 'michael.o@bizboosters.co.uk'
WHERE id = '673afa99-2f8d-465a-9a0c-dfeda11f9a47'
AND provider = 'smtp';