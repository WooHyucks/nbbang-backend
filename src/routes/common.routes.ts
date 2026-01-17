import { Router } from 'express';
import * as commonController from '../controllers/common.controller';

const router = Router();

/**
 * Common Routes
 * 공통 API 엔드포인트
 */

// 환율 조회 (인증 불필요)
router.get('/exchange-rate', (req, res, next) => {
  void commonController.getExchangeRate(req, res, next);
});

// 국가 목록 조회 (인증 불필요)
router.get('/countries', (req, res, next) => {
  void commonController.getCountries(req, res, next);
});

// 환율 수동 동기화 (개발/관리용)
router.post('/sync-exchange-rates', (req, res, next) => {
  void commonController.syncExchangeRates(req, res, next);
});

export default router;


