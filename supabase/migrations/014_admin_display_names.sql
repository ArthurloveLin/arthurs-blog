-- 014_admin_display_names.sql
-- Set display_name in user metadata for admin accounts

UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || '{"display_name": "Arthur"}'::jsonb
WHERE email = 'arthur071684@outlook.com';

UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || '{"display_name": "Grace"}'::jsonb
WHERE email = '1370316384@qq.com';
