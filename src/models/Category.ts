import * as z from 'zod';

const ExpenseCategory = z.object({
	id: z.string(),
	name: z.string(),
	is_income: z.literal(false),
	hidden: z.boolean(),
	budgeted: z.number(),
	spent: z.number(),
	balance: z.number()
});

const RevenueCategory = z.object({
	id: z.string(),
	name: z.string(),
	is_income: z.literal(true),
	hidden: z.boolean(),
	received: z.number()
});

const CategoryZ = z.discriminatedUnion('is_income', [ExpenseCategory, RevenueCategory]);

export type ExpenseCategory = z.infer<typeof ExpenseCategory>;
export type RevenueCategory = z.infer<typeof RevenueCategory>;
export type CategoryZ = z.infer<typeof CategoryZ>;

export const CategoryGroupSchema = z.object({
	id: z.string(),
	name: z.string(),
	categories: z.array(CategoryZ)
});

export type CategoryGroup = z.infer<typeof CategoryGroupSchema>;

export type ExpenseCategoryInfo = {
	id: string,
	name: string,
	balance: number
};

export type RevenueCategoryInfo = {
	id: string,
	name: string,
	received: number
};

export type CategoryInfo = ExpenseCategoryInfo | RevenueCategoryInfo;
