import { prisma } from '../utils/prisma.util';

/**
 * Contribution Repository
 * 멤버별 초기 공금 관리
 */
export class ContributionRepository {
  /**
   * 멤버별 기여금 생성
   */
  async create(memberId: number, meetingId: number, amountKRW: number): Promise<void> {
    await prisma.contribution.upsert({
      where: {
        memberId_meetingId: {
          memberId,
          meetingId,
        },
      },
      create: {
        memberId,
        meetingId,
        amountKRW,
      },
      update: {
        amountKRW,
      },
    });
  }

  /**
   * 모임의 모든 기여금 조회
   */
  async readListByMeetingId(meetingId: number): Promise<Array<{ memberId: number; amountKRW: number }>> {
    const contributions = await prisma.contribution.findMany({
      where: { meetingId },
      select: {
        memberId: true,
        amountKRW: true,
      },
    });
    return contributions;
  }

  /**
   * 멤버별 기여금 조회
   */
  async readByMemberId(memberId: number, meetingId: number): Promise<number> {
    const contribution = await prisma.contribution.findUnique({
      where: {
        memberId_meetingId: {
          memberId,
          meetingId,
        },
      },
    });
    return contribution?.amountKRW || 0;
  }

  /**
   * 모임의 총 기여금 합계 계산
   */
  async getTotalByMeetingId(meetingId: number): Promise<number> {
    const result = await prisma.contribution.aggregate({
      where: { meetingId },
      _sum: {
        amountKRW: true,
      },
    });
    return result._sum.amountKRW || 0;
  }

  /**
   * 멤버별 기여금에 금액 추가 (공금 추가 기능)
   * 기존 금액이 있으면 더하고, 없으면 새로 생성
   */
  async addAmount(memberId: number, meetingId: number, amountKRW: number): Promise<void> {
    const existing = await prisma.contribution.findUnique({
      where: {
        memberId_meetingId: {
          memberId,
          meetingId,
        },
      },
    });

    const newAmount = (existing?.amountKRW || 0) + amountKRW;

    await prisma.contribution.upsert({
      where: {
        memberId_meetingId: {
          memberId,
          meetingId,
        },
      },
      create: {
        memberId,
        meetingId,
        amountKRW: newAmount,
      },
      update: {
        amountKRW: newAmount,
      },
    });
  }

  /**
   * 모임의 모든 기여금 삭제
   */
  async deleteByMeetingId(meetingId: number): Promise<void> {
    await prisma.contribution.deleteMany({
      where: { meetingId },
    });
  }
}














