import * as z from 'zod'

export const Account = z.object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    balance: z.number(),
    offbudget: z.boolean(),
    closed: z.boolean(),
})

export type Account = z.infer<typeof Account>

export type AccountsResponse = {
    accounts: Account[]
}
