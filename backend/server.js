require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const materiRoutes = require('./routes/materi');
const soalRoutes = require('./routes/soal');
const progressRoutes = require('./routes/progress');
const aiRoutes = require('./routes/ai');

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => res.json({ success: true, data: { status: 'ok' }, message: 'OK' }));

app.use('/api/auth', authRoutes);
app.use('/api/materi', materiRoutes);
app.use('/api/soal', soalRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/ai', aiRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, data: null, message: 'Endpoint tidak ditemukan' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ success: false, data: null, message: err.message || 'Server error' });
});

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/belajar-3t';

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });

module.exports = app;
