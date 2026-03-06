export type AppRole = 'superadmin' | 'sup' | 'picker' | 'packer' | 'user';

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
    lot_number: string | null;
    created_by: string;
    created_at: string;
};

export type InventoryLot = {
    id: string;
    product_id: string;
    location_id: string;
    lot_number: string;
    mfg_date: string | null;
    exp_date: string | null;
    quantity: number;
    created_at: string;
};

export type AdjustmentRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type AdjustmentRequest = {
    id: string;
    product_id: string;
    location_id: string;
    quantity_change: number;
    reason: string;
    status: AdjustmentRequestStatus;
    requested_by: string;
    reviewed_by: string | null;
    reviewed_at: string | null;
    created_at: string;
    product?: { sku: string; name: string };
    location?: { bin_code: string; zone_name: string };
    requester?: { full_name: string };
    reviewer?: { full_name: string };
};
