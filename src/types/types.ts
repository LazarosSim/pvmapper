export type User = {
    id: string,
    username: string,
    role: string,
    createdAt: Date
}

export type RawUser = {
    id: string,
    username: string,
    role: string,
    created_at: string
}

export function mapUser(raw: RawUser): User {
    return {
        id: raw.id,
        username: raw.username,
        role: raw.role,
        createdAt: new Date(raw.created_at)
    }
}


export type RawPark = {
    id: string,
    name: string,
    expected_barcodes: number,
    current_barcodes: number,
    created_at: string,
    created_by: string,
    validate_barcode_length: boolean,
    archived: boolean,
    archived_at: string | null,
}

export type Park = {
    id: string,
    name: string,
    createdAt: Date,
    createdBy: string,
    expectedBarcodes: number,
    currentBarcodes: number,
    validateBarcodeLength: boolean,
    archived: boolean,
    archivedAt: Date | null,
}

export function mapPark(raw: RawPark): Park {
    return {
        id: raw.id,
        name: raw.name,
        createdAt: new Date(raw.created_at),
        createdBy: raw.created_by,
        expectedBarcodes: raw.expected_barcodes,
        currentBarcodes: raw.current_barcodes,
        validateBarcodeLength: raw.validate_barcode_length,
        archived: raw.archived ?? false,
        archivedAt: raw.archived_at ? new Date(raw.archived_at) : null,
    }
}