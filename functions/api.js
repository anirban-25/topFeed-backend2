import express from "express";
import timeout from "connect-timeout";
import serverless from "serverless-http";
import dotenv from "dotenv";
import cors from "cors";
import redditRoutes from "../src/routes/redditRoutes.js";
import { processRedditData } from "../src/controllers/redditController.js";

dotenv.config();

const app = express();

// Middleware to set timeout
app.use(timeout('120s')); // Timeout in seconds
app.use((req, res, next) => {
  if (!req.timedout) next();
});

app.use(cors());
app.use(express.json());

app.get("/api/test", (req, res) => {
  res.json({ message: "API is working" });
});

app.post("/api/reddit", processRedditData);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal Server Error" });
});

export const handler = serverless(app);
