import { Router } from 'express';
import * as meetingController from '../controllers/meeting.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

/**
 * Meeting Routes
 * Python의 meeting/presentation.py의 router와 동일한 엔드포인트
 */

// 인증 불필요 (구체적인 라우트를 먼저 등록)
router.get('/share/trip', meetingController.getTripDashboard);
router.get('/share/:uuid', meetingController.getSharePageByUuid);
router.get('/trip-page', meetingController.getTripPage);
router.get('/share-page', meetingController.getSharePage);

// 인증 필요
router.post('', authMiddleware, meetingController.createMeeting);
router.post('/simple', authMiddleware, meetingController.createSimpleMeeting);
router.post('/trip', authMiddleware, meetingController.createTripMeeting);
router.get('/simple/:meeting_id', authMiddleware, meetingController.getSimpleMeeting);
router.patch('/simple/:meeting_id', authMiddleware, meetingController.updateSimpleMeeting);
router.get('', authMiddleware, meetingController.getMeetings);
router.get('/:meeting_id', authMiddleware, meetingController.getMeeting);
router.get('/:meeting_id/dashboard', authMiddleware, meetingController.getTripDashboardById);
router.get('/:meeting_id/result', authMiddleware, meetingController.getTripResult);
router.get('/:meeting_id/result/trip', authMiddleware, meetingController.getTripSettlementResult);
router.put('/:meeting_id', authMiddleware, meetingController.updateMeeting);
router.delete('/:meeting_id', authMiddleware, meetingController.deleteMeeting);
router.put('/:meeting_id/kakao-deposit-id', authMiddleware, meetingController.editMeetingKakaoDeposit);
router.put('/:meeting_id/bank-account', authMiddleware, meetingController.editMeetingTossDeposit);
router.post('/:meeting_id/budget', authMiddleware, meetingController.addBudget);
router.post('/:meeting_id/images', authMiddleware, ...meetingController.uploadImages);
router.patch('/:meeting_id/images', authMiddleware, meetingController.updateImages);

export default router;

