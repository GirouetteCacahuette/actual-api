import * as z from 'zod'

export const CreateTransactionRequestSchema = z.object({
    accountId: z.string().min(1, 'Account ID is required'),
    date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
    description: z.string().min(1, 'Description is required'),
    amount: z.number().finite('Amount must be a valid number'),
    categoryId: z.string().min(1, 'Category ID is required'),
})

const TransactionResponse = z.object({
    success: z.boolean(),
    message: z.string(),
})

export type TransactionResponse = z.infer<typeof TransactionResponse>
