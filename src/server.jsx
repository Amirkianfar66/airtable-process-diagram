import express from "express";
import bodyParser from "body-parser";
import parseItem from "./api/parse-item.js";
import pnidActions from "./api/pnid-actions.js";
import AIPNIDGenerator from "./api/AIPNIDGenerator.jsx";

const app = express();
app.use(bodyParser.json());

// Routes
app.post("/api/parse-item", parseItem);
app.post("/api/pnid-actions", pnidActions);
app.post("/api/ai-generate", AIPNIDGenerator);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Backend running on port ${PORT}`));
