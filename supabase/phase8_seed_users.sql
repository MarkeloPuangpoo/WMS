-- ==========================================
-- Seeds Mock Accounts for Testing RBAC
-- Password for all accounts: password123
-- ==========================================
DO $$
DECLARE superadmin_id uuid := gen_random_uuid();
sup_id uuid := gen_random_uuid();
picker_id uuid := gen_random_uuid();
packer_id uuid := gen_random_uuid();
BEGIN -- 1. Insert into auth.users (creates the user accounts)
-- We only insert if the email does not already exist
IF NOT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE email = 'admin@colamarc.com'
) THEN
INSERT INTO auth.users (
        id,
        instance_id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        confirmation_token,
        recovery_token,
        email_change_token_new,
        email_change
    )
VALUES (
        superadmin_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        'admin@colamarc.com',
        crypt('password123', gen_salt('bf')),
        now(),
        now(),
        now(),
        '',
        '',
        '',
        ''
    );
INSERT INTO auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
    )
VALUES (
        superadmin_id,
        superadmin_id,
        format(
            '{"sub":"%s","email":"%s"}',
            superadmin_id::text,
            'admin@colamarc.com'
        )::jsonb,
        'email',
        'admin@colamarc.com',
        now(),
        now(),
        now()
    );
ELSE
SELECT id INTO superadmin_id
FROM auth.users
WHERE email = 'admin@colamarc.com';
END IF;
IF NOT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE email = 'manager@colamarc.com'
) THEN
INSERT INTO auth.users (
        id,
        instance_id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        confirmation_token,
        recovery_token,
        email_change_token_new,
        email_change
    )
VALUES (
        sup_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        'manager@colamarc.com',
        crypt('password123', gen_salt('bf')),
        now(),
        now(),
        now(),
        '',
        '',
        '',
        ''
    );
INSERT INTO auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
    )
VALUES (
        sup_id,
        sup_id,
        format(
            '{"sub":"%s","email":"%s"}',
            sup_id::text,
            'manager@colamarc.com'
        )::jsonb,
        'email',
        'manager@colamarc.com',
        now(),
        now(),
        now()
    );
ELSE
SELECT id INTO sup_id
FROM auth.users
WHERE email = 'manager@colamarc.com';
END IF;
IF NOT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE email = 'picker@colamarc.com'
) THEN
INSERT INTO auth.users (
        id,
        instance_id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        confirmation_token,
        recovery_token,
        email_change_token_new,
        email_change
    )
VALUES (
        picker_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        'picker@colamarc.com',
        crypt('password123', gen_salt('bf')),
        now(),
        now(),
        now(),
        '',
        '',
        '',
        ''
    );
INSERT INTO auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
    )
VALUES (
        picker_id,
        picker_id,
        format(
            '{"sub":"%s","email":"%s"}',
            picker_id::text,
            'picker@colamarc.com'
        )::jsonb,
        'email',
        'picker@colamarc.com',
        now(),
        now(),
        now()
    );
ELSE
SELECT id INTO picker_id
FROM auth.users
WHERE email = 'picker@colamarc.com';
END IF;
IF NOT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE email = 'packer@colamarc.com'
) THEN
INSERT INTO auth.users (
        id,
        instance_id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        confirmation_token,
        recovery_token,
        email_change_token_new,
        email_change
    )
VALUES (
        packer_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        'packer@colamarc.com',
        crypt('password123', gen_salt('bf')),
        now(),
        now(),
        now(),
        '',
        '',
        '',
        ''
    );
INSERT INTO auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
    )
VALUES (
        packer_id,
        packer_id,
        format(
            '{"sub":"%s","email":"%s"}',
            packer_id::text,
            'packer@colamarc.com'
        )::jsonb,
        'email',
        'packer@colamarc.com',
        now(),
        now(),
        now()
    );
ELSE
SELECT id INTO packer_id
FROM auth.users
WHERE email = 'packer@colamarc.com';
END IF;
-- 2. Update public.user_profiles safely using ON CONFLICT since it's a primary key
INSERT INTO public.user_profiles (id, full_name, role)
VALUES (
        superadmin_id,
        'Super Admin',
        'superadmin'::public.app_role
    ),
    (
        sup_id,
        'Warehouse Manager',
        'sup'::public.app_role
    ),
    (
        picker_id,
        'John Picker',
        'picker'::public.app_role
    ),
    (
        packer_id,
        'Jane Packer',
        'packer'::public.app_role
    ) ON CONFLICT (id) DO
UPDATE
SET full_name = EXCLUDED.full_name,
    role = EXCLUDED.role;
END $$;