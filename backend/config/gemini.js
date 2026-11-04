import { GoogleGenAI } from '@google/genai';

if (!process.env.GEMINI_API_KEY) {
  console.warn('GEMINI_API_KEY is missing. AI audit requests will fail until it is added to .env');
}

const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

export default ai;
