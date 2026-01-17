import { Router } from 'express';
import * as memberController from '../controllers/member.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router({ mergeParams: true });

/**
 * Member Routes
 * Python의 member/presentation.py의 router와 동일한 엔드포인트
 */

router.post('', authMiddleware, (req, res, next) => {
  void memberController.createMember(req, res, next);
});
router.get('', authMiddleware, (req, res, next) => {
  void memberController.getMembers(req, res, next);
});
router.put('/:member_id', authMiddleware, (req, res, next) => {
  void memberController.updateMember(req, res, next);
});
router.delete('/:member_id', authMiddleware, (req, res, next) => {
  void memberController.deleteMember(req, res, next);
});

export default router;

