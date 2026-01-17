import { Payment } from '../domains/payment.domain';
import { MeetingRepository } from '../repositories/meeting.repository';
import { PaymentRepository } from '../repositories/payment.repository';
import { MemberRepository } from '../repositories/member.repository';
import { Calculate } from '../domains/calculate.domain';
import { PaymentDTO, setDTO } from '../dto/payment.dto';
import { CurrencyService } from './currency.service';

/**
 * Payment Service
 * Python의 payment/service.py와 동일한 로직
 */
export class PaymentService {
  private meetingRepository: MeetingRepository;
  private paymentRepository: PaymentRepository;
  private memberRepository: MemberRepository;
  private currencyService: CurrencyService;

  constructor() {
    this.meetingRepository = new MeetingRepository();
    this.paymentRepository = new PaymentRepository();
    this.memberRepository = new MemberRepository();
    this.currencyService = new CurrencyService();
  }

  /**
   * Python: def create(self, place, price, pay_member_id, attend_member_ids, meeting_id, user_id)
   * 
   * @param place - 장소
   * @param price - 금액 (원화 또는 외화)
   * @param payMemberId - 결제한 멤버 ID
   * @param attendMemberIds - 참여한 멤버 ID 배열
   * @param meetingId - 모임 ID
   * @param userId - 사용자 ID
   * @param name - 지출 내역명 (선택사항, 없으면 place 사용)
   * @param originalPrice - 현지 통화 금액 (외화인 경우, 선택사항)
   * @param currency - 통화 코드 (기본값: "KRW")
   * @param payerId - 결제자 ID (null이면 공금으로 결제)
   */
  async create(
    place: string,
    price: number,
    payMemberId: number,
    attendMemberIds: number[],
    meetingId: number,
    userId: number,
    name?: string,
    originalPrice?: number | null,
    currency?: string,
    payerId?: number | null,
    type?: 'PUBLIC' | 'INDIVIDUAL',
    exchangeRate?: number | null, // 사용자 입력 환율 (INDIVIDUAL인 경우)
    date?: string | Date, // 결제 날짜 (선택적, 개인 결제의 경우 환율 조회용)
  ): Promise<Payment> {
    const meeting = await this.meetingRepository.readById(meetingId);
    if (!meeting) {
      throw new Error('Meeting not found');
    }
    meeting.isUserOfMeeting(userId);

    // type 결정: 명시적으로 제공되면 사용, 아니면 payerId로 판단
    const paymentType = type || (payerId === null || payerId === 0 ? 'PUBLIC' : 'INDIVIDUAL');

    // 공금 결제일 때는 payMemberId를 0으로 설정 (공금 결제임을 표시)
    const finalPayMemberId = paymentType === 'PUBLIC' ? 0 : payMemberId;

    // 통화 결정:
    // 1순위: DTO에서 넘어온 currency
    // 2순위: 모임의 targetCurrency (여행 모드인 경우 해당 나라 통화)
    // 3순위: 'KRW'
    const targetCurrency = currency || meeting.targetCurrency || 'KRW';
    
    let finalPrice = 0;
    let finalOriginalPrice: number | null = null;
    let finalCurrency = targetCurrency;
    let finalExchangeRate: number | null = null;

    // 환율 적용 로직: 환율 이원화 정책
    // 1. 원화 결제인 경우
    if (targetCurrency === 'KRW') {
      // KRW 결제는 절대 다른 통화로 변환하지 않음
      finalCurrency = 'KRW';
      finalExchangeRate = 1.0;
      
      // originalPrice가 있으면 사용, 없으면 price를 originalPrice로 사용
      // KRW 결제도 originalPrice를 반드시 저장해야 함
      finalOriginalPrice = originalPrice !== null && originalPrice !== undefined 
        ? originalPrice 
        : price;
      
      // finalPrice는 originalPrice와 동일 (KRW이므로)
      finalPrice = finalOriginalPrice;
    } else {
      // 2. 외화 결제인 경우
      // originalPrice가 있으면 사용, 없으면 price를 originalPrice로 사용
      finalOriginalPrice = originalPrice !== null && originalPrice !== undefined 
        ? originalPrice 
        : price;
      
      // exchange_rate 컬럼에는 항상 "그날 그 나라 환율"만 저장해야 함
      // 1) exchangeRate 파라미터가 있으면 그대로 사용
      // 2) 없으면 CurrencyService를 통해 해당 날짜/통화의 환율 조회
      const targetDate =
        date !== undefined && date !== null
          ? (typeof date === 'string' ? new Date(date) : date)
          : new Date();
        
        if (exchangeRate && exchangeRate > 0) {
          finalExchangeRate = exchangeRate;
        } else {
          try {
            finalExchangeRate = await this.currencyService.getRate(finalCurrency, targetDate);
          } catch (error) {
          throw new Error(
            `Failed to fetch exchange rate for ${finalCurrency}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
          }
        }

      // 최종 환율로 원화 금액 계산
      finalPrice = Math.round(finalOriginalPrice * finalExchangeRate);
    }

    const payment = new Payment(
      null,
      place,
      finalPrice,
      finalPayMemberId,
      attendMemberIds,
      meetingId,
      name,
      finalOriginalPrice,
      finalCurrency,
      finalExchangeRate,
      payerId,
      paymentType,
    );
    
    await this.paymentRepository.create(payment);
    return payment;
  }

  /**
   * Python: def update(self, id, place, price, pay_member_id, attend_member_ids, meeting_id, user_id)
   */
  async update(
    id: number,
    place: string,
    price: number,
    payMemberId: number,
    attendMemberIds: number[],
    meetingId: number,
    userId: number,
    name?: string,
    originalPrice?: number | null,
    currency?: string,
    payerId?: number | null,
    type?: 'PUBLIC' | 'INDIVIDUAL',
    exchangeRate?: number | null,
    date?: string | Date, // 결제 날짜 (선택적, 개인 결제의 경우 환율 조회용)
  ): Promise<void> {
    const meeting = await this.meetingRepository.readById(meetingId);
    if (!meeting) {
      throw new Error('Meeting not found');
    }
    meeting.isUserOfMeeting(userId);

    // 기존 결제 정보 조회 (통화/금액 기본값 유지용)
    const existingPayment = await this.paymentRepository.readById(id);
    if (!existingPayment) {
      throw new Error('Payment not found');
    }

    // type 결정: 명시적으로 제공되면 사용, 아니면 payerId로 판단
    const paymentType = type || (payerId === null || payerId === 0 ? 'PUBLIC' : 'INDIVIDUAL');

    // 공금 결제일 때는 payMemberId를 0으로 설정 (공금 결제임을 표시)
    const finalPayMemberId = paymentType === 'PUBLIC' ? 0 : payMemberId;

    // 통화 결정:
    // 1순위: DTO currency
    // 2순위: 기존 결제의 currency
    // 3순위: 모임의 targetCurrency
    // 4순위: 'KRW'
    const targetCurrency =
      currency ??
      existingPayment.currency ??
      meeting.targetCurrency ??
      'KRW';

    let finalPrice = price; // DTO에서 온 price (null일 수 있음)
    let finalOriginalPrice: number | null = null;
    let finalCurrency = targetCurrency;
    let finalExchangeRate: number | null = null;

    // originalPrice 결정: DTO 값 우선, 없으면 기존 값
    const targetOriginalPrice = originalPrice ?? existingPayment.originalPrice ?? price;

    // 1. KRW 결제 처리
    if (targetCurrency === 'KRW') {
      // [KRW 결제]
      finalCurrency = 'KRW';
      finalExchangeRate = 1.0;
      finalOriginalPrice = targetOriginalPrice;
      // [Fix] KRW는 price가 null로 와도 원가로 강제 동기화
      finalPrice = targetOriginalPrice; // KRW는 원가 그대로
    } else {
      // 2. 외화 결제: PUBLIC / INDIVIDUAL 구분 없이 항상 "그날 그 나라 환율" 사용
      finalOriginalPrice =
        originalPrice !== null && originalPrice !== undefined
          ? originalPrice
          : existingPayment.originalPrice !== null && existingPayment.originalPrice !== undefined
            ? existingPayment.originalPrice
            : price;

      const targetDate =
        date !== undefined && date !== null
          ? (typeof date === 'string' ? new Date(date) : date)
          : new Date();

        if (exchangeRate && exchangeRate > 0) {
        // 사용자가 수동 입력한 환율이 있으면 우선 사용
          finalExchangeRate = exchangeRate;
        } else {
          try {
            // CurrencyService.getRate는 Fallback 로직 포함 (주말/공휴일 처리)
            finalExchangeRate = await this.currencyService.getRate(finalCurrency, targetDate);
          } catch (error) {
          throw new Error(
            `Failed to fetch exchange rate for ${finalCurrency}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
          }
        }

      finalPrice = Math.round(finalOriginalPrice * finalExchangeRate);
    }

    const payment = new Payment(
      id,
      place,
      finalPrice,
      finalPayMemberId,
      attendMemberIds,
      meetingId,
      name,
      finalOriginalPrice,
      finalCurrency,
      finalExchangeRate,
      payerId,
      paymentType,
    );
    
    await this.paymentRepository.update(payment);
  }

  /**
   * Python: def delete(self, id, meeting_id, user_id)
   * 결제 삭제
   * 
   * @param id - 결제 ID
   * @param meetingId - 모임 ID
   * @param userId - 사용자 ID
   * @returns 삭제된 결제 정보
   */
  async delete(id: number, meetingId: number, userId: number): Promise<Payment> {
    // 모임 존재 확인 및 권한 확인
    const meeting = await this.meetingRepository.readById(meetingId);
    if (!meeting) {
      throw new Error('Meeting not found');
    }
    meeting.isUserOfMeeting(userId);

    // 삭제할 결제가 존재하는지 확인
    const existingPayment = await this.paymentRepository.readById(id);
    if (!existingPayment) {
      throw new Error('Payment not found');
    }

    // 결제가 해당 모임에 속하는지 확인
    if (existingPayment.meetingId !== meetingId) {
      throw new Error('Payment does not belong to this meeting');
    }

    // 결제 삭제
    await this.paymentRepository.delete(existingPayment);
    
    // 삭제된 결제 정보 반환
    return existingPayment;
  }

  /**
   * Python: def read(self, meeting_id, user_id)
   */
  async read(meetingId: number, userId: number): Promise<PaymentDTO[]> {
    const meeting = await this.meetingRepository.readById(meetingId);
    if (!meeting) {
      throw new Error('Meeting not found');
    }
    meeting.isUserOfMeeting(userId);
    const payments = await this.paymentRepository.readListByMeetingId(meeting.id!);
    const members = await this.memberRepository.readListByMeetingId(meeting.id!);
    const calculate = new Calculate(members, payments);
    calculate.splitPayments();
    return setDTO(PaymentDTO, payments) as PaymentDTO[];
  }

  /**
   * Python: def update_payment_order(self, meeting_id, payment_order_data, user_id)
   */
  async updatePaymentOrder(meetingId: number, paymentOrderData: number[], userId: number): Promise<void> {
    const meeting = await this.meetingRepository.readById(meetingId);
    if (!meeting) {
      throw new Error('Meeting not found');
    }
    meeting.isUserOfMeeting(userId);
    await this.paymentRepository.updateOrder(paymentOrderData);
  }
}

