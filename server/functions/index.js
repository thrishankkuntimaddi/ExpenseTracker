// Cloud Functions — NOT deployed (Spark plan). See server/README.md.
import { initializeApp } from 'firebase-admin/app';

initializeApp();

export { razorpayWebhook, verifyPlayPurchase } from './supporters.js';
export { setuCreateConsent, setuFetch, setuWebhook } from './setu.js';
