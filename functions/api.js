import serverless from "serverless-http";
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import redditRoutes from "../src/routes/redditRoutes.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/test", (req, res) => {
  res.json({ message: "API is working" });
});

// if (typeof redditRoutes === 'function') {
app.use("/api/reddit", redditRoutes);
// } else {
//   console.error('redditRoutes is not a function:', redditRoutes);
// }

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal Server Error" });
});

export const handler = serverless(app);
