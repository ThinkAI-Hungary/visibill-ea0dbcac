INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES (
  '1b2645b2-706c-4847-ada6-7ec02b255765',
  '5abff3e7-0b0e-47eb-9198-4db551668caf',
  '{"email": "viktor.jambor@taxology.hu", "email_verified": true, "name": "Viktor Jámbor", "phone_verified": false, "sub": "5abff3e7-0b0e-47eb-9198-4db551668caf"}'::jsonb,
  'email',
  '5abff3e7-0b0e-47eb-9198-4db551668caf',
  '2025-10-06 14:23:37.719691+00',
  '2025-10-06 14:23:37.71976+00',
  '2025-10-06 14:23:37.71976+00'
);
