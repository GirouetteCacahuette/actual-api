import express, { Request, Response } from 'express';
import { init } from '@actual-app/api';

const app = express();
const PORT: number = 3000;

app.use(express.json());

const getEnvironmentVariables = (): { password: string; serverURL: string } => {
  const password: string | undefined = process.env.ACTUAL_PASSWORD;
  const serverURL: string | undefined = process.env.ACTUAL_SERVER_URL;

  if (!password) {
    throw new Error('ACTUAL_PASSWORD environment variable is required');
  }

  if (!serverURL) {
    throw new Error('ACTUAL_SERVER_URL environment variable is required');
  }

  return { password, serverURL };
};

(async () => {
  try {
    const { password, serverURL } = getEnvironmentVariables();
    
    await init({
      dataDir: '/tmp/actual-data',
      serverURL: serverURL,
      password: password,
    });

    console.log('Actual API initialized successfully');
  } catch (error) {
    console.error('Error initializing Actual API:', error);
  }
})();

app.get('/api/hello', (req: Request, res: Response) => {
  res.json({ message: 'Hello World' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
