import * as z from 'zod'
import { CategoryGroupSchema } from './Category'

export const BudgetMonthSchema = z.object({
    month: z.string(),
    // The following fields are only produced by the envelope budget engine.
    // Under tracking (report) budgeting the underlying spreadsheet cells don't
    // exist and the API returns null for them, so they must accept null.
    incomeAvailable: z.number().nullable(),
    lastMonthOverspent: z.number().nullable(),
    forNextMonth: z.number().nullable(),
    totalBudgeted: z.number(),
    toBudget: z.number().nullable(),
    fromLastMonth: z.number().nullable(),
    totalIncome: z.number(),
    totalSpent: z.number(),
    totalBalance: z.number(),
    categoryGroups: z.array(CategoryGroupSchema),
})

export type BudgetMonth = z.infer<typeof BudgetMonthSchema>

export type CategoryBudget = {
    categoryId: string
    categoryName: string
    budgeted: number
    spent: number
    balance: number
}
