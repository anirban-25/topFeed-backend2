import express from 'express';
import { processCron } from '../controllers/cronController.js';
import { processStarter } from '../controllers/starterController.js';
import { processScale } from '../controllers/scaleController.js';
import { processGrowth } from '../controllers/growthController.js';

const router = express.Router();

router.get('/process-cron', processCron);
router.get('/starter-cron', processStarter);
router.get('/growth-cron', processGrowth);
router.get('/scale-cron', processScale);

export default router