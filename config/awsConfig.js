import { LambdaClient } from '@aws-sdk/client-lambda';
import dotenv from 'dotenv';

dotenv.config();

export const lambdaClient = new LambdaClient({
  region: 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});