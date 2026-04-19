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
