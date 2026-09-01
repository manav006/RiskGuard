import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import apiRoutes from './routes/api.js';
import { loadAllData } from './data/loadData.js';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api', apiRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 8000;

async function start() {
  try {
    await loadAllData();
    app.listen(PORT, () => {
      console.log(`Razorpay risk-manager backend listening on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
