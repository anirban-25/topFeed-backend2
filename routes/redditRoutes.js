import express from 'express';
import { processRedditData } from '../controllers/redditController.js';

const router = express.Router();

router.post('/process', processRedditData);

export default router;  // Change this line to export default