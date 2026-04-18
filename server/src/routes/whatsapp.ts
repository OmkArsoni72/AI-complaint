import { Router } from 'express';
import { handleWhatsAppWebhook } from '../controllers/whatsappController';

const router = Router();

// Twilio makes a POST request to the webhook URL
router.post('/webhook', handleWhatsAppWebhook);

export default router;
