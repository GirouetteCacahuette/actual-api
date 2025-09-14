import express, { Request, Response } from 'express';
import { init, getAccounts, downloadBudget, loadBudget, getBudgetMonth, getCategories, utils } from '@actual-app/api';

const app = express();
const PORT: number = 3000;

app.use(express.json());

// Define TypeScript interfaces for account data
interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
  offbudget: boolean;
  closed: boolean;
  sort_order: number;
}

interface AccountsResponse {
  accounts: Account[];
}

// Define TypeScript interfaces for budget data
interface Budget {
  id: string;
  name: string;
  encrypted: boolean;
}

// Define TypeScript interfaces for category and budget data
interface Category {
  id: string;
  name: string;
  group_id: string;
  is_income: boolean;
  sort_order: number;
}

interface CategoryBudget {
  id: string;
  budgeted: number;
  spent: number;
  balance: number;
}

interface CategoryGroup {
  id: string;
  name: string;
  categories: CategoryBudget[];
}

interface BudgetMonth {
  month: string;
  incomeAvailable: number;
  lastMonthOverspent: number;
  forNextMonth: number;
  totalBudgeted: number;
  toBudget: number;
  fromLastMonth: number;
  totalIncome: number;
  totalSpent: number;
  totalBalance: number;
  categoryGroups: CategoryGroup[];
}

interface RemainingBudgetResponse {
  categoryId: string;
  categoryName: string;
  budgeted: number;
  spent: number;
  balance: number;
}

interface CategoryInfo {
  id: string;
  name: string;
  balance: number;
}

interface CategoriesResponse {
  categories: CategoryInfo[];
}

interface EnvironmentVariables {
    actualDataDir: string;
    password: string;
    serverURL: string;
    syncId: string;
    budgetEncryptionKey: string;
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
            console.error(`Error: Required environment variable ${key} must be set.`);
            process.exit(1);
        }
    }
    
    return envVars;
};

// Helper function to get current month in YYYY-MM format
const getCurrentMonth = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

(async () => {
  try {
    const { password, serverURL, syncId, budgetEncryptionKey, actualDataDir } = getEnvironmentVariables();
    
    await init({
      dataDir: actualDataDir,
      serverURL: serverURL,
      password: password,
    });

    console.log('Actual API initialized successfully');

    // Download the budget
    await downloadBudget(syncId, {password: budgetEncryptionKey});
  } catch (error) {
    console.error('Error during server initialization:', error);
    process.exit(1);
  }
})();

app.get('/api/accounts', async (req: Request, res: Response) => {
  try {
    const accounts: Account[] = await getAccounts();
    const response: AccountsResponse = { accounts };
    res.json(response);
  } catch (error) {
    console.error('Error fetching accounts:', error);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

app.get('/api/budget', async (req: Request, res: Response) => {
  const { category } = req.query;

  if (!category || typeof category !== 'string') {
    return res.status(400).json({ error: 'category query parameter is required and must be a string' });
  }

  try {
    // Fetch all categories to find the category by name
    const categories: Category[] = await getCategories();
    const categoryObj = categories.find(cat => cat.name.toLowerCase() === category.toLowerCase());

    if (!categoryObj) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Get the current month in 'YYYY-MM' format
    const currentMonth = getCurrentMonth();

    // Fetch budget data for the current month
    const budgetData = await getBudgetMonth(currentMonth);

    // Find the budget entry for the specified category by searching through all category groups
    let categoryBudget: CategoryBudget | undefined;
    
    for (const group of budgetData.categoryGroups) {
      if (group.categories) {
        const found = group.categories.find(cat => cat.id === categoryObj.id);
        if (found) {
          categoryBudget = found;
          break;
        }
      }
    }

    if (!categoryBudget) {
      return res.status(404).json({ error: 'Budget data for category not found' });
    }

    // Calculate remaining budget
    const budgetedAmount = utils.integerToAmount(categoryBudget.budgeted);
    const spentAmount = utils.integerToAmount(categoryBudget.spent);
    const balance = utils.integerToAmount(categoryBudget.balance);

    const response: RemainingBudgetResponse = {
      categoryId: categoryObj.id,
      categoryName: categoryObj.name,
      budgeted: budgetedAmount,
      spent: spentAmount,
      balance
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching remaining budget:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/categories', async (req: Request, res: Response) => {
  try {
    // Get all categories
    const categories: Category[] = await getCategories();
    
    // Get current month's budget data to get balance information
    const currentMonth = getCurrentMonth();
    const budgetData = await getBudgetMonth(currentMonth);
    
    // Create a map of category balances from budget data
    const categoryBalances = new Map<string, number>();
    
    for (const group of budgetData.categoryGroups) {
      if (group.categories) {
        for (const catBudget of group.categories) {
          categoryBalances.set(catBudget.id, utils.integerToAmount(catBudget.balance));
        }
      }
    }
    
    // Map categories with their balance information
    const categoriesWithBalance: CategoryInfo[] = categories.map(category => ({
      id: category.id,
      name: category.name,
      balance: categoryBalances.get(category.id) || 0
    }));
    
    const response: CategoriesResponse = { categories: categoriesWithBalance };
    res.json(response);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
