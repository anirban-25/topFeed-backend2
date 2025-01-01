import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import feedRoutes from "./routes/feedRoute.js";
import redditRoutes from "./routes/redditRoutes.js";
import monthlyScheduler from "./routes/monthlyScheduler.js";
// import { initializeFirebase } from './config/firebase.js';
import cronRoute from "./routes/cronRoute.js";

const app = express();
app.use(cors());
app.use(bodyParser.json());

// const PORT = process.env.PORT || 5000;
// Increase the timeout for all routes

app.use((req, res, next) => {
  res.setTimeout(540000, () => {
    console.log("Request has timed out.");
    res.status(408).send("Request Timeout");
  });
  next();
});

// Simple health check route

app.get("/", (req, res) => {
  res.status(200).send("OK");
});

// Routes
app.use("/api", cronRoute);

app.use("/api/feed", feedRoutes);

app.use("/api/reddit", redditRoutes);

app.use("/cron", monthlyScheduler);

export const feedAPI = (req, res) => {
  return app(req, res);
};

// app.listen(PORT, () => {
//   console.log(`Server is running on port ${PORT}`);
// });
