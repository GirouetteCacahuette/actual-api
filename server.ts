import express, { NextFunction, Request, Response } from 'express'
import {
    downloadBudget,
    getAccountBalance,
    getAccounts,
    getBudgetMonth,
    importTransactions,
    init,
    q,
    runQuery,
    sync,
    utils,
} from '@actual-app/api'
import * as z from 'zod'
import {
    ApiAccount,
    CategoryZ,
    BudgetMonthSchema,
    CreateTransactionRequestSchema,
    GetTransactionsQuerySchema,
    ImportTransactionsResultSchema,
    AccountsResponse,
    CreateTransactionResponse,
    GetTransactionsResponse,
    TransactionRecord,
    CategoriesResponse,
    BudgetMonth,
    CategoryBudget,
    Account,
} from './src/models'

type ErrorResponseBody = { error: string }

const app = express()
const PORT: number = 3000

app.use(express.json())
app.use(async (req: Request, _: Response, next: NextFunction) => {
    console.log(
        `${new Date().toISOString()} ${req.method} ${req.path} with query ${req.query.toString()}`
    )

    await sync()
    next()
})

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
            password: process.env.ACTUAL_PASSWORD,
        })
        process.exit(1)
    }
})()

app.get('/api/accounts', async (_, res: Response) => {
    try {
        const accountsData = await getAccounts()

        const validationResult = z.array(ApiAccount).safeParse(accountsData)
        if (!validationResult.success) {
            logError(
                'ZOD_VALIDATION',
                'Accounts validation failed',
                validationResult.error.toString(),
                { rawData: accountsData }
            )
            return res
                .status(500)
                .json({ error: 'Invalid account data received from API' })
        }

        const accounts: Account[] = []

        for (const apiAccount of validationResult.data) {
            const balance = (await getAccountBalance(apiAccount.id)) / 100
            accounts.push({
                ...apiAccount,
                balance,
            })
        }

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

app.get('/api/categories', async (req, res: Response) => {
    const { filter } = req.query

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

        const categoriesInfo: CategoriesResponse = {}

        for (const categoryGroup of budgetData.categoryGroups) {
            for (const category of categoryGroup.categories) {
                if (
                    !filter ||
                    (typeof filter === 'string' &&
                        filter
                            .toLowerCase()
                            .includes(category.name.toLowerCase()))
                ) {
                    categoriesInfo[category.name.replace(' ', '_')] = {
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
                    }
                }
            }
        }

        res.json(categoriesInfo)
    } catch (error) {
        logError('ACTUAL_API', 'Error fetching categories', error)
        res.status(500).json({ error: 'Failed to fetch categories' })
    }
})

app.post('/api/transactions', async (req: Request, res: Response) => {
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

        // amount is integer cents, passed through with no conversion.
        // Actual owns idempotency via imported_id through importTransactions.
        const transaction = {
            account: transactionData.accountId,
            date: transactionData.date,
            amount: transactionData.amount,
            imported_id: transactionData.imported_id,
            payee_name: transactionData.payee_name,
            notes: transactionData.notes,
            category: transactionData.categoryId,
            cleared: transactionData.cleared,
        }

        const importResultRaw = await importTransactions(
            transactionData.accountId,
            [transaction]
        )

        const importValidation =
            ImportTransactionsResultSchema.safeParse(importResultRaw)
        if (!importValidation.success) {
            logError(
                'ZOD_VALIDATION',
                'importTransactions result validation failed',
                importValidation.error,
                { rawResult: importResultRaw }
            )
            return res.status(500).json({
                success: false,
                message: 'Invalid result received from importTransactions',
            })
        }

        const importResult = importValidation.data

        if (importResult.errors && importResult.errors.length > 0) {
            logError(
                'ACTUAL_API',
                'importTransactions reported errors',
                importResult.errors,
                { requestBody: req.body }
            )
            return res.status(500).json({
                success: false,
                message: 'Failed to import transaction',
            })
        }

        // Confirm the import is persisted on the server before responding 201.
        await sync()

        const response: CreateTransactionResponse = {
            success: true,
            added: importResult.added,
            updated: importResult.updated,
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

app.get('/api/transactions', async (req: Request, res: Response) => {
    try {
        const validationResult = GetTransactionsQuerySchema.safeParse(req.query)

        if (!validationResult.success) {
            logError(
                'ZOD_VALIDATION',
                'Transaction query validation failed',
                validationResult.error,
                { query: req.query }
            )
            return res.status(400).json({
                error: 'Provide exactly one of imported_id or imported_id_prefix',
            })
        }

        const { imported_id, imported_id_prefix } = validationResult.data

        const filter = imported_id
            ? { imported_id }
            : { imported_id: { $like: `${imported_id_prefix}%` } }

        const query = q('transactions')
            .filter(filter)
            .select([
                'id',
                'account',
                'date',
                'amount',
                'notes',
                'imported_id',
                'cleared',
                'category',
                { payee_name: 'payee.name' },
            ])

        const { data } = (await runQuery(query)) as { data: any[] }

        const transactions: TransactionRecord[] = data.map((t) => ({
            id: t.id,
            accountId: t.account,
            date: t.date,
            amount: t.amount,
            payee_name: t.payee_name ?? null,
            notes: t.notes ?? null,
            imported_id: t.imported_id ?? null,
            cleared: Boolean(t.cleared),
            category: t.category ?? null,
        }))

        const response: GetTransactionsResponse = transactions
        res.json(response)
    } catch (error) {
        logError('ACTUAL_API', 'Error fetching transactions', error, {
            query: req.query,
        })
        res.status(500).json({ error: 'Failed to fetch transactions' })
    }
})

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})
