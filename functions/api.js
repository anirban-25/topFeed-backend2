import serverless from 'serverless-http';
import express from 'express';
import dotenv from 'dotenv';
import redditRoutes from '../src/routes/redditRoutes.js';

dotenv.config();

const app = express();

app.use(express.json());

// Remove the '/api/reddit' prefix here
app.use('/', redditRoutes);

export const handler = serverless(app);