export type AppRole = 'superadmin' | 'sup' | 'user';

export type UserProfile = {
    id: string; // matches auth.users UUID
    role: AppRole;
    full_name: string;
    created_at: string;
};
