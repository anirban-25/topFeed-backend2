import express from 'express';
import { processCron } from '../controllers/cronController.js';

const router = express.Router();

router.get('/process-cron', processCron);

export default router