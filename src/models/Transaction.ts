import * as z from 'zod'

// Request body for POST /api/transactions.
// Amounts are integer cents, passed through to Actual without conversion.
export const CreateTransactionRequestSchema = z.object({
    accountId: z.string().min(1, 'Account ID is required'),
    imported_id: z.string().min(1, 'imported_id is required'),
    amount: z
        .number()
        .int('Amount must be an integer number of cents')
        .finite('Amount must be a valid number'),
    date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
    payee_name: z.string().optional(),
    notes: z.string().optional(),
    categoryId: z.string().optional(),
    cleared: z.boolean().optional().default(true),
})

export type CreateTransactionRequest = z.infer<
    typeof CreateTransactionRequestSchema
>

// Query params for GET /api/transactions.
// Exactly one of imported_id (exact match) or imported_id_prefix (prefix match).
export const GetTransactionsQuerySchema = z
    .object({
        imported_id: z.string().min(1).optional(),
        imported_id_prefix: z.string().min(1).optional(),
    })
    .refine(
        (q) => (q.imported_id ? 1 : 0) + (q.imported_id_prefix ? 1 : 0) === 1,
        {
            message: 'Provide exactly one of imported_id or imported_id_prefix',
        }
    )

export type GetTransactionsQuery = z.infer<typeof GetTransactionsQuerySchema>

// Result shape returned by Actual's importTransactions.
export const ImportTransactionsResultSchema = z.object({
    added: z.array(z.string()),
    updated: z.array(z.string()),
    errors: z.array(z.unknown()).optional(),
})

export type ImportTransactionsResult = z.infer<
    typeof ImportTransactionsResultSchema
>

// Response body for POST /api/transactions.
export const CreateTransactionResponseSchema = z.object({
    success: z.literal(true),
    added: z.array(z.string()),
    updated: z.array(z.string()),
})

export type CreateTransactionResponse = z.infer<
    typeof CreateTransactionResponseSchema
>

// A single full transaction as returned by GET /api/transactions.
// `id` is Actual's internal id (handle for any future update/delete).
export const TransactionRecordSchema = z.object({
    id: z.string(),
    accountId: z.string(),
    date: z.string(),
    amount: z.number(),
    payee_name: z.string().nullable(),
    notes: z.string().nullable(),
    imported_id: z.string().nullable(),
    cleared: z.boolean(),
    category: z.string().nullable(),
})

export type TransactionRecord = z.infer<typeof TransactionRecordSchema>

export type GetTransactionsResponse = TransactionRecord[]
