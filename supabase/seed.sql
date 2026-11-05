-- Local test data only. These accounts and this password must never reach production.
-- User A and user B exist so tests can prove one user cannot read the other's data.

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
values
  (
    '00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-00000000000a',
    'authenticated', 'authenticated', 'user-a@example.test',
    extensions.crypt('local-test-password', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(),
    '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-00000000000b',
    'authenticated', 'authenticated', 'user-b@example.test',
    extensions.crypt('local-test-password', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(),
    '', '', '', ''
  )
on conflict (id) do nothing;

insert into auth.identities (
  id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(), id, id::text, 'email',
  jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
  now(), now(), now()
from auth.users
where id in ('00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000b')
on conflict (provider_id, provider) do nothing;
