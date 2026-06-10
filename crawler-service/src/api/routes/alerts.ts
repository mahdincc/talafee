import { Router, type Request, type Response } from 'express';
import { AlertValidationError, type AlertService } from '../../services/AlertService.js';

export function createAlertsRouter(alertService: AlertService): Router {
  const router = Router();

  router.get('/vapid-public-key', (_req: Request, res: Response) => {
    res.json({
      success: true,
      publicKey: alertService.getVapidPublicKey(),
    });
  });

  router.post('/subscriptions', (req: Request, res: Response) => {
    const { endpoint, keys } = req.body ?? {};

    if (typeof endpoint !== 'string' || !endpoint || typeof keys?.p256dh !== 'string' || typeof keys?.auth !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Invalid push subscription',
      });
      return;
    }

    alertService.subscribe({ endpoint, keys });
    res.json({ success: true });
  });

  router.get('/', (req: Request, res: Response) => {
    const endpoint = req.query['endpoint'];

    if (typeof endpoint !== 'string' || !endpoint) {
      res.status(400).json({
        success: false,
        error: 'endpoint query parameter is required',
      });
      return;
    }

    res.json({
      success: true,
      data: alertService.listAlerts(endpoint),
      timestamp: new Date().toISOString(),
    });
  });

  router.post('/', (req: Request, res: Response) => {
    const { endpoint, productId, providerId, priceField, lowBound, highBound } = req.body ?? {};

    if (typeof endpoint !== 'string' || !endpoint || typeof productId !== 'string' || !productId) {
      res.status(400).json({
        success: false,
        error: 'endpoint and productId are required',
      });
      return;
    }

    if (priceField !== undefined && priceField !== 'buy' && priceField !== 'sell') {
      res.status(400).json({
        success: false,
        error: "priceField must be 'buy' or 'sell'",
      });
      return;
    }

    try {
      const alert = alertService.createAlert({
        endpoint,
        productId,
        providerId: typeof providerId === 'string' && providerId ? providerId : null,
        priceField,
        lowBound: typeof lowBound === 'number' ? lowBound : null,
        highBound: typeof highBound === 'number' ? highBound : null,
      });

      res.status(201).json({ success: true, data: alert });
    } catch (error) {
      if (error instanceof AlertValidationError) {
        res.status(400).json({ success: false, error: error.message });
        return;
      }
      throw error;
    }
  });

  router.patch('/:id', (req: Request, res: Response) => {
    const { endpoint, enabled, lowBound, highBound } = req.body ?? {};

    if (typeof endpoint !== 'string' || !endpoint) {
      res.status(400).json({
        success: false,
        error: 'endpoint is required',
      });
      return;
    }

    const updated = alertService.updateAlert(req.params['id']!, endpoint, {
      ...(typeof enabled === 'boolean' ? { enabled } : {}),
      ...(lowBound === null || typeof lowBound === 'number' ? { lowBound } : {}),
      ...(highBound === null || typeof highBound === 'number' ? { highBound } : {}),
    });

    if (!updated) {
      res.status(404).json({ success: false, error: 'Alert not found' });
      return;
    }

    res.json({ success: true, data: updated });
  });

  router.delete('/:id', (req: Request, res: Response) => {
    const endpoint = req.query['endpoint'];

    if (typeof endpoint !== 'string' || !endpoint) {
      res.status(400).json({
        success: false,
        error: 'endpoint query parameter is required',
      });
      return;
    }

    const deleted = alertService.deleteAlert(req.params['id']!, endpoint);

    if (!deleted) {
      res.status(404).json({ success: false, error: 'Alert not found' });
      return;
    }

    res.json({ success: true });
  });

  return router;
}
