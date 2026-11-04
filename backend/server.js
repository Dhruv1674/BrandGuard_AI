import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import connectDB from './config/db.js';
import brandRoutes from './routes/brandRoutes.js';
import auditRoutes from './routes/auditRoutes.js';

const app = express();
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map(value => value.trim());
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '1mb' }));

app.get('/', (req, res) => res.json({ success: true, name: 'BrandGuard AI API', message: 'Backend is running.' }));
app.get('/api/health', (req, res) => res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() }));
app.use('/api/brands', brandRoutes);
app.use('/api/audits', auditRoutes);

app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found.' }));
app.use((error, req, res, next) => {
  console.error(error);
  const status = error.name === 'ValidationError' || error.name === 'CastError' ? 400 : 500;
  res.status(status).json({ success: false, message: status === 400 ? error.message : 'Server error. Check the backend terminal for details.' });
});

const port = Number(process.env.PORT) || 5000;
try {
  await connectDB();
  app.listen(port, () => console.log(`BrandGuard AI API listening on http://localhost:${port}`));
} catch (error) {
  console.error('Failed to start backend:', error.message);
  process.exit(1);
}
