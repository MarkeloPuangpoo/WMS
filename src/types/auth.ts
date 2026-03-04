export type AppRole = 'superadmin' | 'sup' | 'user';

export type UserProfile = {
    id: string; // matches auth.users UUID
    role: AppRole;
    full_name: string;
    created_at: string;
};

export type TransactionType = 'INBOUND' | 'OUTBOUND' | 'TRANSFER' | 'ADJUSTMENT';

export type InventoryTransaction = {
    id: string;
    transaction_type: TransactionType;
    product_id: string;
    location_id: string;
    quantity: number;
    reference_doc: string | null;
    notes: string | null;
    created_by: string;
    created_at: string;
};
