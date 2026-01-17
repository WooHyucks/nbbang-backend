import { Response, NextFunction } from 'express';
import { MemberService } from '../services/member.service';
import { AuthRequest } from '../middlewares/auth.middleware';

const memberService = new MemberService();

/**
 * Member Controller
 * Python의 member/presentation.py와 동일한 로직
 */

interface MemberData {
  name: string;
  leader: boolean;
}

interface MemberRequestBody {
  name?: string;
  leader?: boolean;
}

/**
 * Python: @router.post("", status_code=201)
 */
export async function createMember(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const meetingId = parseInt(req.params.meeting_id || '0', 10);
    const body = req.body as Partial<MemberData>;
    const name = body.name || '';
    const leader = body.leader || false;
    await memberService.create(name, leader, meetingId, userId);
    res.status(201).send();
  } catch (error) {
    next(error);
  }
}

/**
 * Python: @router.get("", status_code=200)
 */
export async function getMembers(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const meetingId = parseInt(req.params.meeting_id || '0', 10);
    const members = await memberService.read(meetingId, userId);
    res.status(200).json(members);
  } catch (error) {
    next(error);
  }
}

/**
 * Python: @router.put("/{member_id}", status_code=200)
 */
export async function updateMember(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const meetingId = parseInt(req.params.meeting_id || '0', 10);
    const memberId = parseInt(req.params.member_id || '0', 10);
    // Python 스타일 (snake_case) 지원
    const body = req.body as MemberRequestBody;
    const name = body.name || '';
    const leader = body.leader || false;
    await memberService.update(memberId, name, leader, meetingId, userId);
    res.status(200).send();
  } catch (error) {
    next(error);
  }
}

/**
 * Python: @router.delete("/{member_id}", status_code=200)
 */
export async function deleteMember(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const meetingId = parseInt(req.params.meeting_id || '0', 10);
    const memberId = parseInt(req.params.member_id || '0', 10);
    await memberService.delete(memberId, meetingId, userId);
    res.status(200).send();
  } catch (error) {
    next(error);
  }
}

