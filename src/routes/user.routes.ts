import { Router } from 'express';
import * as userController from '../controllers/user.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

/**
 * User Routes
 * Python의 user/presentation.py의 router와 동일한 엔드포인트
 */

// 인증 필요
router.get('', authMiddleware, (req, res, next) => {
  void userController.getUser(req, res, next);
});
router.delete('', authMiddleware, (req, res, next) => {
  void userController.deleteUser(req, res, next);
});
router.put('/kakao-deposit-id', authMiddleware, (req, res, next) => {
  void userController.editKakaoDeposit(req, res, next);
});
router.put('/bank-account', authMiddleware, (req, res, next) => {
  void userController.editTossDeposit(req, res, next);
});
router.put('/guest', authMiddleware, (req, res, next) => {
  void userController.updateGuest(req, res, next);
});

// 인증 불필요
router.post('/sign-up', (req, res, next) => {
  void userController.signUp(req, res, next);
});
router.post('/sign-in', (req, res, next) => {
  void userController.signIn(req, res, next);
});
router.post('/sign-out', (req, res, next) => {
  void userController.signOut(req, res, next);
});
router.post('/guest', (req, res, next) => {
  void userController.createGuest(req, res, next);
});
router.post('/kakao-login', (req, res, next) => {
  void userController.kakaoLogin(req, res, next);
});
router.post('/naver-login', (req, res, next) => {
  void userController.naverLogin(req, res, next);
});
router.post('/google-login', (req, res, next) => {
  void userController.googleLogin(req, res, next);
});

export default router;

