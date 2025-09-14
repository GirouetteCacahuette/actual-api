import express, { Request, Response } from 'express'
import {
    addTransactions,
    downloadBudget,
    getAccounts,
    getBudgetMonth,
    init,
    utils,
} from '@actual-app/api'
import * as z from 'zod'
import {
    Account,
    CategoryZ,
    BudgetMonthSchema,
    CreateTransactionRequestSchema,
    AccountsResponse,
    TransactionResponse,
    CategoryInfo,
    CategoriesResponse,
    BudgetMonth,
    CategoryBudget,
} from './src/models'

type ErrorResponseBody = { error: string }

const app = express()
const PORT: number = 3000

app.use(express.json())

// Logging utility function for errors only
const logError = (prefix: string, message: string, error?: any, data?: any) => {
    const timestamp = new Date().toISOString()
    const logMessage = `[${timestamp}] [ERROR] [${prefix}] ${message}`
    console.error(logMessage)
    if (error) console.error('Error details:', error)
    if (data !== undefined) {
        console.error('Associated data:', JSON.stringify(data, null, 2))
    }
}

interface EnvironmentVariables {
    actualDataDir: string
    password: string
    serverURL: string
    syncId: string
    budgetEncryptionKey: string
}

const getEnvironmentVariables = (): EnvironmentVariables => {
    const envVars: EnvironmentVariables = {
        actualDataDir: process.env.ACTUAL_DATA_DIR || './cache/actual-data',
        password: process.env.ACTUAL_PASSWORD || '',
        serverURL: process.env.ACTUAL_SERVER_URL || '',
        syncId: process.env.ACTUAL_SYNC_ID || '',
        budgetEncryptionKey: process.env.ACTUAL_BUDGET_ENCRYPTION_KEY || '',
    }

    for (const [key, value] of Object.entries(envVars)) {
        if (!value) {
            logError(
                'ENV',
                `Required environment variable ${key} must be set`,
                new Error('Missing environment variable'),
                { key }
            )
            process.exit(1)
        }
    }

    return envVars
}

const getCurrentMonth = (): string => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    return `${year}-${month}`
}

;(async () => {
    try {
        const {
            password,
            serverURL,
            syncId,
            budgetEncryptionKey,
            actualDataDir,
        } = getEnvironmentVariables()

        await init({
            dataDir: actualDataDir,
            serverURL: serverURL,
            password: password,
        })

        await downloadBudget(syncId, { password: budgetEncryptionKey })
    } catch (error) {
        logError('INIT', 'Error during server initialization', error, {
            serverURL: process.env.ACTUAL_SERVER_URL,
            dataDir: process.env.ACTUAL_DATA_DIR || './cache/actual-data',
            syncId: process.env.ACTUAL_SYNC_ID,
        })
        process.exit(1)
    }
})()

app.get('/api/accounts', async (_, res: Response) => {
    try {
        const accountsData = await getAccounts()

        const validationResult = z.array(Account).safeParse(accountsData)
        if (!validationResult.success) {
            logError(
                'ZOD_VALIDATION',
                'Accounts validation failed',
                validationResult.error,
                { rawData: accountsData }
            )
            return res
                .status(500)
                .json({ error: 'Invalid account data received from API' })
        }

        const accounts = validationResult.data
        const response: AccountsResponse = { accounts }
        res.json(response)
    } catch (error) {
        logError('ACTUAL_API', 'Error fetching accounts', error)
        res.status(500).json({ error: 'Failed to fetch accounts' })
    }
})

app.get(
    '/api/budget',
    async (req: Request, res: Response<CategoryBudget | ErrorResponseBody>) => {
        const { categoryName } = req.query

        if (!categoryName || typeof categoryName !== 'string') {
            logError(
                'VALIDATION',
                'Missing or invalid category query parameter',
                new Error('Invalid category parameter'),
                { categoryName, query: req.query }
            )
            return res.status(400).json({
                error: 'category query parameter is required and must be a string',
            })
        }

        try {
            const currentMonth = getCurrentMonth()
            const budgetDataRaw = await getBudgetMonth(currentMonth)

            const budgetValidation = BudgetMonthSchema.safeParse(budgetDataRaw)
            if (!budgetValidation.success) {
                logError(
                    'ZOD_VALIDATION',
                    'Budget validation failed',
                    budgetValidation.error,
                    { rawData: budgetDataRaw }
                )
                return res
                    .status(500)
                    .json({ error: 'Invalid budget data received from API' })
            }

            const budgetData: BudgetMonth = budgetValidation.data

            let categoryBudget: CategoryZ | undefined

            for (const group of budgetData.categoryGroups) {
                if (group.categories && Array.isArray(group.categories)) {
                    const found = group.categories.find(
                        (cat) =>
                            cat.name.toLowerCase() ===
                            categoryName.toLowerCase()
                    )
                    if (found) {
                        categoryBudget = found
                        break
                    }
                }
            }

            if (!categoryBudget || categoryBudget.is_income) {
                logError(
                    'VALIDATION',
                    `Budget data not found for category ${categoryName}`
                )
                return res.status(404).json({
                    error: `Budget data for category ${categoryName} not found`,
                })
            }

            const budgetedAmount = utils.integerToAmount(
                categoryBudget.budgeted
            )
            const spentAmount = utils.integerToAmount(categoryBudget.spent)
            const balance = utils.integerToAmount(categoryBudget.balance)

            const response = {
                categoryId: categoryBudget.id,
                categoryName: categoryBudget.name,
                budgeted: budgetedAmount,
                spent: spentAmount,
                balance,
            }

            res.json(response)
        } catch (error) {
            logError('ACTUAL_API', 'Error fetching budget data', error)
            res.status(500).json({ error: 'Internal server error' })
        }
    }
)

app.get('/api/categories', async (_, res: Response) => {
    try {
        const currentMonth = getCurrentMonth()
        const budgetDataRaw = await getBudgetMonth(currentMonth)

        const budgetValidation = BudgetMonthSchema.safeParse(budgetDataRaw)
        if (!budgetValidation.success) {
            logError(
                'ZOD_VALIDATION',
                'Budget validation failed',
                budgetValidation.error,
                { rawData: budgetDataRaw }
            )
            return res
                .status(500)
                .json({ error: 'Invalid budget data received from API' })
        }

        const budgetData = budgetValidation.data

        const categoriesInfo: CategoryInfo[] = budgetData.categoryGroups
            .map((categoryGroup) => {
                return categoryGroup.categories.map((category) => ({
                    id: category.id,
                    name: category.name,
                    ...(category.is_income
                        ? {
                              received: utils.integerToAmount(
                                  (category as any).received
                              ),
                          }
                        : {
                              balance: utils.integerToAmount(
                                  (category as any).balance
                              ),
                          }),
                }))
            })
            .flat()

        const response: CategoriesResponse = { categories: categoriesInfo }
        res.json(response)
    } catch (error) {
        logError('ACTUAL_API', 'Error fetching categories', error)
        res.status(500).json({ error: 'Failed to fetch categories' })
    }
})

app.post('/api/transaction', async (req: Request, res: Response) => {
    try {
        const validationResult = CreateTransactionRequestSchema.safeParse(
            req.body
        )

        if (!validationResult.success) {
            logError(
                'ZOD_VALIDATION',
                'Transaction validation failed',
                validationResult.error,
                { requestBody: req.body }
            )
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: validationResult.error.issues,
            })
        }

        const transactionData = validationResult.data

        const transaction = {
            account: transactionData.accountId,
            date: transactionData.date,
            notes: transactionData.description,
            amount: utils.amountToInteger(transactionData.amount),
            category: transactionData.categoryId,
            cleared: true,
        }

        await addTransactions(transactionData.accountId, [transaction])

        const response: TransactionResponse = {
            success: true,
            message: 'Transaction created successfully',
        }

        res.status(201).json(response)
    } catch (error) {
        logError('ACTUAL_API', 'Error creating transaction', error, {
            requestBody: req.body,
        })
        res.status(500).json({
            success: false,
            message: 'Failed to create transaction',
        })
    }
})

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})
