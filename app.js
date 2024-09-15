import express from 'express';
import bodyParser from 'body-parser';
import feedRoutes from './routes/feedRoute.js';


const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());

// Routes
app.use('/api/feed', feedRoutes);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
