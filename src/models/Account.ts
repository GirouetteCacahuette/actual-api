import * as z from 'zod'

export const ApiAccount = z.object({
    id: z.string(),
    name: z.string(),
    offbudget: z.boolean(),
    closed: z.boolean(),
})

export type ApiAccount = z.infer<typeof ApiAccount>

export type Account = ApiAccount & {
    balance: number
}

export type AccountsResponse = {
    accounts: Account[]
}

// Request body for POST /api/accounts.
// The account is created with a starting balance of 0.
export const CreateAccountRequestSchema = z.object({
    name: z.string().trim().min(1, 'Name is required'),
    offBudget: z.boolean().optional().default(false),
})

export type CreateAccountRequest = z.infer<typeof CreateAccountRequestSchema>

// Response body for POST /api/accounts.
export const CreateAccountResponseSchema = z.object({
    success: z.literal(true),
    id: z.string(),
})

export type CreateAccountResponse = z.infer<typeof CreateAccountResponseSchema>
