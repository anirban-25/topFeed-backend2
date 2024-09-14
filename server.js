import serverless from 'serverless-http';
import express from 'express';
import dotenv from 'dotenv';
import redditRoutes from '../src/routes/redditRoutes.js';

dotenv.config();

const app = express();

app.use(express.json());

app.use('/api/reddit', redditRoutes);

// Wrap your Express app with serverless-http
export const handler = serverless(app);