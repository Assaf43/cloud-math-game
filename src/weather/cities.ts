import type { City } from '../types';

export const CITIES: readonly City[] = [
  { id: 'jerusalem', name: 'ירושלים', hint: 'עיר הבירה', lat: 31.778, lon: 35.235 },
  { id: 'tel-aviv', name: 'תל אביב', hint: 'העיר שלא נחה', lat: 32.085, lon: 34.782 },
  { id: 'haifa', name: 'חיפה', hint: 'עיר על הר מול מפרץ', lat: 32.794, lon: 34.990 },
  { id: 'eilat', name: 'אילת', hint: 'העיר הדרומית ביותר', lat: 29.558, lon: 34.948 },
  { id: 'beer-sheva', name: 'באר שבע', hint: 'בירת הנגב', lat: 31.252, lon: 34.791 },
  { id: 'tiberias', name: 'טבריה', hint: 'עיר על שפת הכנרת', lat: 32.796, lon: 35.531 },
  { id: 'acre', name: 'עכו', hint: 'עיר נמל עתיקה בצפון', lat: 32.928, lon: 35.076 },
  { id: 'ashdod', name: 'אשדוד', hint: 'עיר נמל בדרום', lat: 31.804, lon: 34.655 },
  { id: 'mitzpe-ramon', name: 'מצפה רמון', hint: 'עיר על שפת מכתש', lat: 30.610, lon: 34.801 },
  { id: 'caesarea', name: 'קיסריה', hint: 'עיר רומית עתיקה על הים', lat: 32.519, lon: 34.905 },
];
