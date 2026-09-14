import dotenv from 'dotenv';
dotenv.config();

// MongoDB: use MONGODB_URI for Atlas or local. e.g. mongodb://localhost:27017/campusbuzz or mongodb+srv://user:pass@cluster.mongodb.net/campusbuzz
export const dbConfig = {
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/campusbuzz',
};
