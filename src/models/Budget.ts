import * as z from 'zod'
import { CategoryGroupSchema } from './Category'

export const BudgetMonthSchema = z.object({
    month: z.string(),
    incomeAvailable: z.number(),
    lastMonthOverspent: z.number(),
    forNextMonth: z.number(),
    totalBudgeted: z.number(),
    toBudget: z.number(),
    fromLastMonth: z.number(),
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
