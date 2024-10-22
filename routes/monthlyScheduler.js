import express from 'express';
import { monthlySchedulerController } from '../controllers/monthlySchedulerController.js';

const router = express.Router();

router.get('/', monthlySchedulerController);

export default router;  // Change this line to export default