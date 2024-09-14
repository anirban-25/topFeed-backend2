import serverless from 'serverless-http';
import express from 'express';
import dotenv from 'dotenv';
import redditRoutes from '../src/routes/redditRoutes.js';

dotenv.config();

const app = express();

app.use(express.json());

// Check if redditRoutes is a function (router)
if (typeof redditRoutes === 'function') {
  app.use('/api/reddit', redditRoutes);
} else {
  console.error('redditRoutes is not a function:', redditRoutes);
  // You might want to add some default routing here
}

export const handler = serverless(app);