import { Router } from 'express';
import * as paymentController from '../controllers/payment.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router({ mergeParams: true });

/**
 * Payment Routes
 * Python의 payment/presentation.py의 router와 동일한 엔드포인트
 */

router.post('', authMiddleware, (req, res, next) => {
  void paymentController.createPayment(req, res, next);
});
router.get('', authMiddleware, (req, res, next) => {
  void paymentController.getPayments(req, res, next);
});
router.put('/order', authMiddleware, (req, res, next) => {
  void paymentController.updatePaymentOrder(req, res, next);
});
router.put('/:payment_id', authMiddleware, (req, res, next) => {
  void paymentController.updatePayment(req, res, next);
});
router.delete('/:payment_id', authMiddleware, (req, res, next) => {
  void paymentController.deletePayment(req, res, next);
});

export default router;

