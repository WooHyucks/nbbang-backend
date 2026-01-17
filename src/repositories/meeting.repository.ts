import { prisma } from '../utils/prisma.util';
import { Meeting } from '../domains/meeting.domain';
import { SimpleMeetingRequest } from '../types/meeting.types';

/**
 * Meeting Repository
 * Python의 meeting/repository.py와 동일한 로직
 */
export class MeetingRepository {
  /**
   * Python: def create(self, meeting: Meeting)
   */
  async create(meeting: Meeting): Promise<void> {
    try {
      const bank = meeting.tossDepositInformation.bank instanceof Buffer
        ? meeting.tossDepositInformation.bank
        : null;
      const accountNumber = meeting.tossDepositInformation.accountNumber instanceof Buffer
        ? meeting.tossDepositInformation.accountNumber
        : null;

      const meetingData = {
        name: meeting.name,
        date: meeting.date,
        userId: meeting.userId,
        uuid: meeting.uuid!,
        accountNumber,
        bank,
        kakaoDepositId: meeting.kakaoDepositInformation.kakaoDepositId,
        isSimple: meeting.isSimple,
        simplePrice: meeting.simplePrice,
        simpleMemberCount: meeting.simpleMemberCount,
        images: meeting.images,
        isTrip: meeting.isTrip,
        countryCode: meeting.countryCode,
        targetCurrency: meeting.targetCurrency,
        baseExchangeRate: meeting.baseExchangeRate,
        initialGonggeum: meeting.initialGonggeum,
      };

      const meetingModel = await prisma.meeting.create({
        data: meetingData,
      });
      meeting.id = meetingModel.id;
    } catch (error: any) {
      
      // Prisma 에러인 경우 더 자세한 정보 제공
      if (error?.code === 'P2002') {
        throw new Error(`Unique constraint failed: ${error.meta?.target}`);
      } else if (error?.code === 'P2003') {
        throw new Error(`Foreign key constraint failed: ${error.meta?.field_name}`);
      } else if (error?.code === 'P2011') {
        throw new Error(`Null constraint violation: ${error.meta?.constraint}`);
      } else if (error?.code === 'P2012') {
        throw new Error(`Missing required value: ${error.meta?.target}`);
      } else if (error?.code === 'P2025') {
        throw new Error(`Record not found: ${error.meta?.cause}`);
      } else if (error?.code === 'P2022') {
        // 컬럼이 존재하지 않는 경우
        const columnName = error.meta?.column || 'unknown';
        throw new Error(`Database column '${columnName}' does not exist. Please run the migration SQL in MIGRATION_GUIDE.md or Supabase SQL Editor.`);
      } else if (error?.message?.includes('Unknown column') || (error?.message?.includes('column') && error?.message?.includes('does not exist'))) {
        throw new Error(`Database column missing. Please run migration: ${error.message}`);
      }
      
      if (error instanceof Error) {
        throw new Error(`Failed to create meeting: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Python: def update_information(self, meeting: Meeting)
   */
  async updateInformation(meeting: Meeting): Promise<void> {
    await prisma.meeting.update({
      where: { id: meeting.id! },
      data: {
        name: meeting.name,
        date: meeting.date,
      },
    });
  }

  /**
   * Python: def update_simple_meeting_data(self, meeting_id, simple_meeting_request)
   */
  async updateSimpleMeetingData(meetingId: number, simpleMeetingRequest: SimpleMeetingRequest): Promise<void> {
    // undefined 필드는 업데이트하지 않도록 필터링
    const updateData: {
      name?: string;
      date?: string;
      simplePrice?: number | null;
      simpleMemberCount?: number | null;
    } = {};
    
    if (simpleMeetingRequest.name !== undefined) {
      updateData.name = simpleMeetingRequest.name;
    }
    if (simpleMeetingRequest.date !== undefined) {
      updateData.date = simpleMeetingRequest.date;
    }
    if (simpleMeetingRequest.simplePrice !== undefined) {
      updateData.simplePrice = simpleMeetingRequest.simplePrice;
    }
    if (simpleMeetingRequest.simpleMemberCount !== undefined) {
      updateData.simpleMemberCount = simpleMeetingRequest.simpleMemberCount;
    }
    
    await prisma.meeting.update({
      where: { id: meetingId },
      data: updateData,
    });
  }

  /**
   * Python: def update_toss_deposit(self, meeting: Meeting)
   */
  async updateTossDeposit(meeting: Meeting): Promise<void> {
    const bank = meeting.tossDepositInformation.bank instanceof Buffer
      ? meeting.tossDepositInformation.bank
      : null;
    const accountNumber = meeting.tossDepositInformation.accountNumber instanceof Buffer
      ? meeting.tossDepositInformation.accountNumber
      : null;

    await prisma.meeting.update({
      where: { id: meeting.id! },
      data: {
        bank,
        accountNumber,
      },
    });
  }

  /**
   * Python: def update_kakao_deposit(self, meeting: Meeting)
   */
  async updateKakaoDeposit(meeting: Meeting): Promise<void> {
    await prisma.meeting.update({
      where: { id: meeting.id! },
      data: {
        kakaoDepositId: meeting.kakaoDepositInformation.kakaoDepositId,
      },
    });
  }

  /**
   * Python: def delete(self, meeting: Meeting)
   */
  async delete(meeting: Meeting): Promise<void> {
    await prisma.meeting.delete({
      where: { id: meeting.id! },
    });
  }

  /**
   * Python: def read_list_by_user_id(self, user_id)
   */
  async readListByUserId(userId: number): Promise<Meeting[]> {
    const meetingModels = await prisma.meeting.findMany({
      where: { userId },
      orderBy: { id: 'desc' },
    });

    return meetingModels.map((model: {
      id: number;
      name: string;
      date: string;
      userId: number;
      uuid: string;
      isSimple: boolean;
      isTrip: boolean;
      countryCode: string | null;
      targetCurrency: string | null;
      baseExchangeRate: number | null;
      initialGonggeum: number | null;
      createdAt: Date;
      updatedAt: Date;
    }) => {
      return new Meeting(
        model.id,
        model.name,
        model.date,
        model.userId,
        model.uuid,
        null,
        null,
        null,
        model.isSimple,
        null,
        null,
        null,
        [],
        model.isTrip,
        model.countryCode,
        model.targetCurrency,
        model.baseExchangeRate,
        model.initialGonggeum,
        model.createdAt,
        model.updatedAt,
      );
    });
  }

  /**
   * Python: def read_by_id(self, meeting_id)
   */
  async readById(meetingId: number): Promise<Meeting | null> {
    // meetingId가 유효한 숫자인지 확인
    if (typeof meetingId !== 'number' || isNaN(meetingId) || meetingId <= 0) {
      throw new Error(`Invalid meeting ID: ${meetingId}`);
    }
    
    const meetingModel = await prisma.meeting.findUnique({
      where: { id: meetingId },
    });

    if (!meetingModel) {
      return null;
    }

    const images = Array.isArray(meetingModel.images) ? (meetingModel.images as string[]) : [];
    return new Meeting(
      meetingModel.id,
      meetingModel.name,
      meetingModel.date,
      meetingModel.userId,
      meetingModel.uuid,
      meetingModel.bank,
      meetingModel.accountNumber,
      meetingModel.kakaoDepositId,
      meetingModel.isSimple,
      meetingModel.simplePrice,
      meetingModel.simpleMemberCount,
      null, // simpleMemberAmount
      images,
      meetingModel.isTrip,
      meetingModel.countryCode,
      meetingModel.targetCurrency,
      meetingModel.baseExchangeRate,
      meetingModel.initialGonggeum,
    );
  }

  /**
   * Python: def read_by_uuid(self, meeting_uuid)
   */
  async readByUuid(meetingUuid: string): Promise<Meeting | null> {
    const meetingModel = await prisma.meeting.findUnique({
      where: { uuid: meetingUuid },
    });

    if (!meetingModel) {
      return null;
    }

    const images = Array.isArray(meetingModel.images) ? (meetingModel.images as string[]) : [];
    return new Meeting(
      meetingModel.id,
      meetingModel.name,
      meetingModel.date,
      meetingModel.userId,
      meetingModel.uuid,
      meetingModel.bank,
      meetingModel.accountNumber,
      meetingModel.kakaoDepositId,
      meetingModel.isSimple,
      meetingModel.simplePrice,
      meetingModel.simpleMemberCount,
      null, // simpleMemberAmount
      images,
      meetingModel.isTrip,
      meetingModel.countryCode,
      meetingModel.targetCurrency,
      meetingModel.baseExchangeRate,
      meetingModel.initialGonggeum,
      meetingModel.createdAt,
      meetingModel.updatedAt,
    );
  }

  /**
   * Python: def read_images(self, meeting_id)
   */
  async readImages(meetingId: number): Promise<string[] | null> {
    const meetingModel = await prisma.meeting.findUnique({
      where: { id: meetingId },
      select: { images: true },
    });

    if (!meetingModel || !meetingModel.images) {
      return null;
    }

    return meetingModel.images as string[];
  }

  /**
   * Python: def update_images(self, meeting_id, images)
   */
  async updateImages(meetingId: number, images: string[]): Promise<void> {
    await prisma.meeting.update({
      where: { id: meetingId },
      data: { images },
    });
  }

  /**
   * 해외여행 모임 조회 (대시보드용 - members, contributions, payments 포함)
   * 
   * @param uuid - 모임 UUID
   * @returns Meeting과 관련 데이터 (members, contributions, payments)
   */
  async findTripByUuid(uuid: string): Promise<{
    meeting: any;
    members: any[];
    contributions: any[];
    payments: any[];
  } | null> {
    const meetingModel = await prisma.meeting.findUnique({
      where: { uuid },
      include: {
        members: {
          orderBy: [
            { leader: 'desc' },
            { id: 'asc' },
          ],
        },
        contributions: true,
        payments: {
          orderBy: [
            { orderNo: { sort: 'asc', nulls: 'last' } },
            { id: 'desc' },
          ],
        },
      },
    });

    if (!meetingModel) {
      return null;
    }

    return {
      meeting: meetingModel,
      members: meetingModel.members,
      contributions: meetingModel.contributions,
      payments: meetingModel.payments,
    };
  }
}

