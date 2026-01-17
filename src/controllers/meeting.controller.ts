import { Request, Response, NextFunction } from 'express';
import { MeetingService } from '../services/meeting.service';
import { AuthRequest } from '../middlewares/auth.middleware';
import { MeetingRequest, SimpleMeetingRequest } from '../types/meeting.types';
import multer from 'multer';

const meetingService = new MeetingService();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * Meeting Controller
 * Python의 meeting/presentation.py와 동일한 로직
 */

/**
 * Python: @router.post("", status_code=201)
 */
export async function createMeeting(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const meeting = await meetingService.add(userId);
    res.status(201).setHeader('Location', `meeting/${meeting.id}`).send();
  } catch (error) {
    next(error);
  }
}

/**
 * Python: @router.post("/simple", status_code=201)
 */
export async function createSimpleMeeting(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const meeting = await meetingService.createSimpleMeeting(userId);
    res.status(201).setHeader('Location', `meeting/${meeting.id}`).send();
  } catch (error) {
    next(error);
  }
}

/**
 * 해외여행 정산 모드 모임 생성
 * POST /meeting/trip
 */
export async function createTripMeeting(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const body = req.body as { 
      country_code?: string; 
      countryCode?: string; 
      total_foreign?: number; 
      totalForeign?: number;
      contributions?: Array<{ 
        member_id?: number; 
        memberId?: number; 
        amount_krw?: number; 
        amountKRW?: number;
        member_name?: string;
        memberName?: string;
        name?: string;
      }>;
      advance_payments?: Array<{
        name: string;
        price: number;
        pay_member_name: string;
      }>;
      advancePayments?: Array<{
        name: string;
        price: number;
        payMemberName: string;
      }>;
    };
    
    const countryCode = body.country_code || body.countryCode;
    const totalForeign = body.total_foreign || body.totalForeign;
    const contributions = body.contributions?.map(c => ({
      memberId: c.member_id || c.memberId || 0,
      amountKRW: c.amount_krw || c.amountKRW || 0,
      name: c.member_name || c.memberName || c.name, // member_name을 name으로 매핑
    }));
    const advancePayments = (body.advance_payments || body.advancePayments)?.map(ap => ({
      name: ap.name,
      price: ap.price,
      payMemberName: (ap as any).pay_member_name || (ap as any).payMemberName,
    }));
    
    if (!countryCode) {
      res.status(400).json({ detail: 'country_code is required' });
      return;
    }
    
    const meeting = await meetingService.createTripMeeting(
      userId,
      countryCode,
      totalForeign,
      contributions,
      advancePayments,
    );
    res.status(201)
      .setHeader('Location', `meeting/${meeting.id}`)
      .setHeader('Access-Control-Expose-Headers', 'Location')
      .send();
  } catch (error) {
    next(error);
  }
}

/**
 * Python: @router.get("/simple/{meeting_id}", status_code=200)
 */
export async function getSimpleMeeting(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const meetingId = parseInt(req.params.meeting_id || '0', 10);
    const meeting = await meetingService.readSimpleMeeting(meetingId, userId);
    res.status(200).json(meeting.toJSON());
  } catch (error) {
    next(error);
  }
}

/**
 * Python: @router.patch("/simple/{meeting_id}", status_code=200)
 */
export async function updateSimpleMeeting(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const meetingId = parseInt(req.params.meeting_id || '0', 10);
      // Python 스타일 (snake_case) 지원
      const body = req.body as Partial<SimpleMeetingRequest & { simple_price?: number | string; simple_member_count?: number | string }>;
      
      // 숫자 필드를 숫자로 변환 (문자열로 들어올 수 있음)
      const simplePrice = body.simple_price ?? body.simplePrice;
      const simpleMemberCount = body.simple_member_count ?? body.simpleMemberCount;
      
      const simpleMeetingData: SimpleMeetingRequest = {
        name: body.name,
        date: body.date,
        simplePrice: simplePrice !== undefined ? (typeof simplePrice === 'string' ? parseFloat(simplePrice) : simplePrice) : undefined,
        simpleMemberCount: simpleMemberCount !== undefined ? (typeof simpleMemberCount === 'string' ? parseInt(String(simpleMemberCount), 10) : simpleMemberCount) : undefined,
      };
    await meetingService.updateSimpleMeetingData(meetingId, userId, simpleMeetingData);
    res.status(200).send();
  } catch (error) {
    next(error);
  }
}

/**
 * Python: @router.get("", status_code=200)
 */
export async function getMeetings(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const meetings = await meetingService.readMeetings(userId);
    res.status(200).json(meetings.map(meeting => meeting.toJSON()));
  } catch (error) {
    next(error);
  }
}

/**
 * Python: @router.get("/share-page", status_code=200)
 */
/**
 * 해외여행 정산 결과 조회
 * GET /meeting/:meeting_id/result/trip
 */
export async function getTripSettlementResult(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const meetingIdParam = req.params.meeting_id;
    if (!meetingIdParam) {
      res.status(400).json({ detail: 'Meeting ID is required' });
      return;
    }
    const meetingId = parseInt(meetingIdParam, 10);
    if (isNaN(meetingId) || meetingId <= 0) {
      res.status(400).json({ detail: 'Invalid meeting ID' });
      return;
    }
    
    const result = await meetingService.getTripSettlementResult(meetingId, userId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * 해외여행 대시보드 조회 (인증 필요)
 * GET /meeting/:meeting_id/dashboard
 */
export async function getTripDashboardById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const meetingIdParam = req.params.meeting_id;
    if (!meetingIdParam) {
      res.status(400).json({ detail: 'Meeting ID is required' });
      return;
    }
    const meetingId = parseInt(meetingIdParam, 10);
    if (isNaN(meetingId) || meetingId <= 0) {
      res.status(400).json({ detail: 'Invalid meeting ID' });
      return;
    }

    // 페이지네이션 파라미터 파싱
    const limitParam = req.query.limit;
    const offsetParam = req.query.offset;
    const limit = limitParam ? parseInt(String(limitParam), 10) : 10;
    const offset = offsetParam ? parseInt(String(offsetParam), 10) : 0;

    if (isNaN(limit) || limit < 1 || limit > 100) {
      res.status(400).json({ detail: 'Invalid limit (must be between 1 and 100)' });
      return;
    }
    if (isNaN(offset) || offset < 0) {
      res.status(400).json({ detail: 'Invalid offset (must be >= 0)' });
      return;
    }

    const dashboard = await meetingService.getTripDashboard(String(meetingId), userId, true, limit, offset);
    res.status(200).json(dashboard);
  } catch (error) {
    next(error);
  }
}

/**
 * 해외여행 최종 정산 결과 조회
 * GET /meeting/:meeting_id/result
 */
export async function getTripResult(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const meetingIdParam = req.params.meeting_id;
    if (!meetingIdParam) {
      res.status(400).json({ detail: 'Meeting ID is required' });
      return;
    }
    const meetingId = parseInt(meetingIdParam, 10);
    if (isNaN(meetingId) || meetingId <= 0) {
      res.status(400).json({ detail: 'Invalid meeting ID' });
      return;
    }

    const result = await meetingService.getTripResult(meetingId, userId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * 여행 정산 결과 페이지 조회 (UUID 기반, 인증 불필요)
 * GET /meeting/trip-page?uuid={uuid}
 */
export async function getTripPage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const uuidParam = req.query.uuid;
    let uuid: string;
    if (typeof uuidParam === 'string') {
      uuid = uuidParam;
    } else if (Array.isArray(uuidParam) && uuidParam.length > 0 && typeof uuidParam[0] === 'string') {
      uuid = uuidParam[0];
    } else {
      res.status(400).json({ detail: 'uuid parameter is required' });
      return;
    }
    const tripPage = await meetingService.readTripPage(uuid);
    res.status(200).json(tripPage);
  } catch (error) {
    next(error);
  }
}

/**
 * 해외여행 실시간 대시보드 조회 (공금 모니터링 중심)
 * GET /meeting/share/trip?uuid={uuid}
 * 
 * 선택적 쿼리 파라미터:
 * - user_id: 로그인한 사용자 ID (나의 공금 지분 표시용)
 */
export async function getTripDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const uuidParam = req.query.uuid;
    let uuid: string;
    if (typeof uuidParam === 'string') {
      uuid = uuidParam;
    } else if (Array.isArray(uuidParam) && uuidParam.length > 0 && typeof uuidParam[0] === 'string') {
      uuid = uuidParam[0];
    } else {
      res.status(400).json({ detail: 'uuid parameter is required' });
      return;
    }

    // 선택적: user_id 파라미터 (로그인한 사용자의 공금 지분 표시용)
    const userIdParam = req.query.user_id;
    let userId: number | undefined;
    if (userIdParam) {
      const parsed = typeof userIdParam === 'string' 
        ? parseInt(userIdParam, 10) 
        : Array.isArray(userIdParam) && userIdParam.length > 0
          ? parseInt(String(userIdParam[0]), 10)
          : NaN;
      if (!isNaN(parsed) && parsed > 0) {
        userId = parsed;
      }
    }

    // 페이지네이션 파라미터 파싱
    const limitParam = req.query.limit;
    const offsetParam = req.query.offset;
    const limit = limitParam ? parseInt(String(limitParam), 10) : 10;
    const offset = offsetParam ? parseInt(String(offsetParam), 10) : 0;

    if (isNaN(limit) || limit < 1 || limit > 100) {
      res.status(400).json({ detail: 'Invalid limit (must be between 1 and 100)' });
      return;
    }
    if (isNaN(offset) || offset < 0) {
      res.status(400).json({ detail: 'Invalid offset (must be >= 0)' });
      return;
    }

    const dashboard = await meetingService.getTripDashboard(uuid, userId, false, limit, offset);
    res.status(200).json(dashboard);
  } catch (error) {
    next(error);
  }
}

/**
 * 공유 페이지 조회 (UUID 기반, 인증 불필요)
 * GET /meeting/share/:uuid
 */
export async function getSharePageByUuid(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const uuid = req.params.uuid;
    if (!uuid) {
      res.status(400).json({ detail: 'uuid parameter is required' });
      return;
    }
    const sharePage = await meetingService.readSharePageByUuid(uuid);
    res.status(200).json(sharePage);
  } catch (error) {
    next(error);
  }
}

/**
 * Python: @router.get("/share-page", status_code=200)
 */
export async function getSharePage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const uuidParam = req.query.uuid;
    let uuid: string;
    if (typeof uuidParam === 'string') {
      uuid = uuidParam;
    } else if (Array.isArray(uuidParam) && uuidParam.length > 0 && typeof uuidParam[0] === 'string') {
      uuid = uuidParam[0];
    } else {
      res.status(400).json({ detail: 'uuid parameter is required' });
      return;
    }
    const sharePage: any = await meetingService.readSharePage(uuid);
    // meeting 객체를 toJSON()으로 변환
    if (sharePage.meeting) {
      sharePage.meeting = sharePage.meeting.toJSON();
    }
    res.status(200).json(sharePage);
  } catch (error) {
    next(error);
  }
}

/**
 * Python: @router.get("/{meeting_id}", status_code=200)
 */
export async function getMeeting(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const meetingIdParam = req.params.meeting_id;
    if (!meetingIdParam) {
      res.status(400).json({ detail: 'Meeting ID is required' });
      return;
    }
    const meetingId = parseInt(meetingIdParam, 10);
    if (isNaN(meetingId) || meetingId <= 0) {
      res.status(400).json({ detail: 'Invalid meeting ID' });
      return;
    }
    const meeting = await meetingService.read(meetingId, userId);
    res.status(200).json(meeting.toJSON());
  } catch (error) {
    next(error);
  }
}

/**
 * Python: @router.put("/{meeting_id}", status_code=200)
 */
export async function updateMeeting(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const meetingId = parseInt(req.params.meeting_id || '0', 10);
    const meetingData = req.body as Partial<MeetingRequest>;
    await meetingService.editInformation(
      meetingId,
      userId,
      meetingData.name || '',
      meetingData.date || '',
    );
    res.status(200).send();
  } catch (error) {
    next(error);
  }
}

/**
 * Python: @router.delete("/{meeting_id}", status_code=200)
 */
export async function deleteMeeting(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const meetingId = parseInt(req.params.meeting_id || '0', 10);
    await meetingService.remove(meetingId, userId);
    res.status(200).send();
  } catch (error) {
    next(error);
  }
}

/**
 * Python: @router.put("/{meeting_id}/kakao-deposit-id", status_code=200)
 */
export async function editMeetingKakaoDeposit(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const meetingId = parseInt(req.params.meeting_id || '0', 10);
      // Python 스타일 (snake_case) 지원
      const body = req.body as Partial<{ kakao_deposit_id?: string; kakaoDepositId?: string }>;
      const kakaoDepositId = body.kakao_deposit_id ?? body.kakaoDepositId ?? null;
    await meetingService.editKakaoDeposit(meetingId, userId, kakaoDepositId);
    res.status(200).send();
  } catch (error) {
    next(error);
  }
}

/**
 * Python: @router.put("/{meeting_id}/bank-account", status_code=200)
 */
export async function editMeetingTossDeposit(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const meetingId = parseInt(req.params.meeting_id || '0', 10);
      // Python 스타일 (snake_case) 지원
      const body = req.body as Partial<{ bank?: string; account_number?: string; accountNumber?: string }>;
      const bank = body.bank ?? '';
      const accountNumber = body.account_number ?? body.accountNumber ?? '';
    await meetingService.editTossDeposit(meetingId, userId, bank, accountNumber);
    res.status(200).send();
  } catch (error) {
    next(error);
  }
}

/**
 * Python: @router.post("/{meeting_id}/images", status_code=200)
 */
export const uploadImages = [
  upload.array('images'),
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const files = req.files as Express.Multer.File[];
      const images = files.map((file) => ({
        filename: file.originalname,
        buffer: file.buffer,
      }));
      const result = await meetingService.uploadImages(images);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },
];

/**
 * Python: @router.patch("/{meeting_id}/images", status_code=200)
 */
export async function updateImages(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const meetingId = parseInt(req.params.meeting_id || '0', 10);
    const images = Array.isArray(req.body) ? (req.body as string[]) : [];
    await meetingService.updateImages(meetingId, userId, images);
    res.status(200).send();
  } catch (error) {
    next(error);
  }
}

/**
 * 외화 기준 공금 추가
 * POST /meeting/:meetingId/budget
 */
export async function addBudget(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const meetingIdParam = req.params.meeting_id || req.params.meetingId;
    if (!meetingIdParam) {
      res.status(400).json({ detail: 'Meeting ID is required' });
      return;
    }
    const meetingId = parseInt(meetingIdParam, 10);
    if (isNaN(meetingId) || meetingId <= 0) {
      res.status(400).json({ detail: 'Invalid meeting ID' });
      return;
    }

    const body = req.body as { 
      foreignAmount?: number; 
      foreign_amount?: number;
      memberIds?: number[]; 
      member_ids?: number[];
    };

    const foreignAmount = body.foreignAmount ?? body.foreign_amount;
    const memberIds = body.memberIds ?? body.member_ids;

    if (foreignAmount === undefined || foreignAmount === null) {
      res.status(400).json({ detail: 'foreignAmount is required' });
      return;
    }

    if (typeof foreignAmount !== 'number' || foreignAmount <= 0) {
      res.status(400).json({ detail: 'foreignAmount must be a positive number' });
      return;
    }

    if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
      res.status(400).json({ detail: 'memberIds is required and must be a non-empty array' });
      return;
    }

    await meetingService.addBudgetWithForeignCurrency(meetingId, userId, foreignAmount, memberIds);
    res.status(200).send();
  } catch (error) {
    next(error);
  }
}

