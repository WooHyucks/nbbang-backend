import { prisma } from '../utils/prisma.util';
import { Payment } from '../domains/payment.domain';

/**
 * Payment Repository
 * Python의 payment/repository.py와 동일한 로직
 * 개선: attend_member_ids를 Int[] 배열로 직접 저장 (JSON 인코딩/디코딩 불필요)
 */
export class PaymentRepository {
  /**
   * Python: def create(self, payment: Payment)
   */
  async create(payment: Payment): Promise<void> {
    try {
      const paymentData: any = {
        place: payment.place,
        price: payment.price,
        payMemberId: payment.payMemberId,
        attendMemberIds: payment.attendMemberIds,
        meetingId: payment.meetingId,
      };
      
      // 새로운 필드들은 선택적으로 추가 (마이그레이션 전 하위 호환성)
      if ((payment as any).name !== undefined) {
        paymentData.name = payment.name;
      }
      if (payment.originalPrice !== null && payment.originalPrice !== undefined) {
        paymentData.originalPrice = payment.originalPrice;
      }
      // currency가 명시되면 항상 업데이트 (KRW 포함)
      if (payment.currency) {
        paymentData.currency = payment.currency;
      }
      if (payment.exchangeRate !== null && payment.exchangeRate !== undefined) {
        paymentData.exchangeRate = payment.exchangeRate;
      }
      if (payment.payerId !== null && payment.payerId !== undefined) {
        paymentData.payerId = payment.payerId;
      }
      if (payment.type) {
        paymentData.type = payment.type;
      }
      
      const paymentModel = await prisma.payment.create({
        data: paymentData,
      });
      payment.id = paymentModel.id;
    } catch (error: any) {
      // console.error('Error in PaymentRepository.create:', error);
      if (error?.code === 'P2022') {
        const columnName = error.meta?.column || 'unknown';
        throw new Error(`Database column 'Payment.${columnName}' does not exist. Please run the migration SQL in MIGRATION_GUIDE.md`);
      }
      throw error;
    }
  }

  /**
   * Python: def update(self, payment: Payment)
   */
  async update(payment: Payment): Promise<void> {
    try {
      const paymentData: any = {
        place: payment.place,
        price: payment.price,
        payMemberId: payment.payMemberId,
        attendMemberIds: payment.attendMemberIds,
      };
      
      // 새로운 필드들은 선택적으로 추가 (마이그레이션 전 하위 호환성)
      if ((payment as any).name !== undefined) {
        paymentData.name = payment.name;
      }
      if (payment.originalPrice !== null && payment.originalPrice !== undefined) {
        paymentData.originalPrice = payment.originalPrice;
      }
      // currency가 명시되면 항상 업데이트 (KRW 포함)
      if (payment.currency) {
        paymentData.currency = payment.currency;
      }
      if (payment.exchangeRate !== null && payment.exchangeRate !== undefined) {
        paymentData.exchangeRate = payment.exchangeRate;
      }
      if (payment.payerId !== null && payment.payerId !== undefined) {
        paymentData.payerId = payment.payerId;
      }
      if ((payment as any).type !== undefined) {
        paymentData.type = payment.type;
      } else {
        // 하위 호환성: payerId가 null이면 PUBLIC
        paymentData.type = payment.payerId === null ? 'PUBLIC' : 'INDIVIDUAL';
      }
      
      await prisma.payment.update({
        where: { id: payment.id! },
        data: paymentData,
      });
    } catch (error: any) {
      // console.error('Error in PaymentRepository.update:', error);
      if (error?.code === 'P2022') {
        const columnName = error.meta?.column || 'unknown';
        throw new Error(`Database column 'Payment.${columnName}' does not exist. Please run the migration SQL in MIGRATION_GUIDE.md`);
      }
      throw error;
    }
  }

  /**
   * 단일 결제 조회
   * 기존 결제 정보를 기반으로 통화/금액 업데이트 시 사용
   */
  async readById(id: number): Promise<Payment | null> {
    try {
      const model = await prisma.payment.findUnique({
        where: { id },
      });

      if (!model) {
        return null;
      }

      // type이 PUBLIC이면 payMemberId를 0으로 설정 (공금 결제 표시)
      const paymentType = (model as any).type || (model.payerId === null ? 'PUBLIC' : 'INDIVIDUAL');
      const payMemberId = paymentType === 'PUBLIC' ? 0 : model.payMemberId;

      return new Payment(
        model.id,
        model.place,
        model.price,
        payMemberId,
        model.attendMemberIds,
        model.meetingId,
        (model as any).name || model.place,
        (model as any).originalPrice || null,
        (model as any).currency || 'KRW',
        (model as any).exchangeRate || null,
        (model as any).payerId || null,
        paymentType,
      );
    } catch (error: any) {
      // console.error('Error in PaymentRepository.readById:', error);
      if (error?.code === 'P2022') {
        const columnName = error.meta?.column || 'unknown';
        throw new Error(`Database column 'Payment.${columnName}' does not exist. Please run the migration SQL in MIGRATION_GUIDE.md`);
      }
      throw error;
    }
  }

  /**
   * Python: def delete(self, payment: Payment)
   */
  async delete(payment: Payment): Promise<void> {
    await prisma.payment.delete({
      where: { id: payment.id! },
    });
  }

  /**
   * Python: def read_list_by_meeting_id(self, meeting_id)
   */
  async readListByMeetingId(meetingId: number): Promise<Payment[]> {
    try {
      const paymentModels = await prisma.payment.findMany({
        where: { meetingId },
        orderBy: [
          { orderNo: { sort: 'asc', nulls: 'last' } },
        ],
      });

      return paymentModels.map((model) => {
        // type이 PUBLIC이면 payMemberId를 0으로 설정 (공금 결제 표시)
        const paymentType = (model as any).type || (model.payerId === null ? 'PUBLIC' : 'INDIVIDUAL');
        const payMemberId = paymentType === 'PUBLIC' ? 0 : model.payMemberId;
        
        return new Payment(
          model.id,
          model.place,
          model.price,
          payMemberId,
          model.attendMemberIds, // 이미 배열로 저장되어 있음
          model.meetingId,
          (model as any).name || model.place, // name 필드가 없으면 place 사용 (하위 호환성)
          (model as any).originalPrice || null,
          (model as any).currency || 'KRW',
          (model as any).exchangeRate || null,
          (model as any).payerId || null,
          paymentType, // 이미 계산된 paymentType 사용
        );
      });
    } catch (error: any) {
      // console.error('Error in PaymentRepository.readListByMeetingId:', error);
      if (error?.code === 'P2022') {
        // 컬럼이 존재하지 않는 경우 - 마이그레이션 필요
        const columnName = error.meta?.column || 'unknown';
        throw new Error(`Database column 'Payment.${columnName}' does not exist. Please run the migration SQL in MIGRATION_GUIDE.md`);
      }
      throw error;
    }
  }

  /**
   * Python: def delete_by_meeting_id(self, meeting_id)
   */
  async deleteByMeetingId(meetingId: number): Promise<void> {
    await prisma.payment.deleteMany({
      where: { meetingId },
    });
  }

  /**
   * Python: def update_order(self, payment_order_data)
   */
  async updateOrder(paymentOrderData: number[]): Promise<void> {
    // Python: for index, payment_id in enumerate(payment_order_data):
    for (let index = 0; index < paymentOrderData.length; index++) {
      const paymentId = paymentOrderData[index];
      await prisma.payment.update({
        where: { id: paymentId },
        data: { orderNo: index },
      });
    }
  }
}

