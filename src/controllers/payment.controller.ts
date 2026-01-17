import { Response, NextFunction } from 'express';
import { PaymentService } from '../services/payment.service';
import { AuthRequest } from '../middlewares/auth.middleware';

const paymentService = new PaymentService();

/**
 * Payment Controller
 * Python의 payment/presentation.py와 동일한 로직
 */

interface PaymentData {
  place: string;
  price: number | string;
  pay_member_id: number | string;
  attend_member_ids: (number | string)[];
  name?: string; // 지출 내역명
  original_price?: number | string | null; // 현지 통화 금액
  currency?: string; // 통화 코드
  payer_id?: number | string | null; // null이면 공금으로 결제
  type?: 'PUBLIC' | 'INDIVIDUAL'; // 결제 타입
  exchange_rate?: number | string | null; // 사용자 입력 환율 (INDIVIDUAL인 경우)
}

/**
 * Python: @router.post("", status_code=201)
 */
export async function createPayment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const meetingId = parseInt(req.params.meeting_id || '0', 10);
    const paymentData = req.body as Partial<PaymentData & { 
      payMemberId?: number | string; 
      attendMemberIds?: (number | string)[];
      originalPrice?: number | string | null;
      payerId?: number | string | null;
    }>;
    const place = paymentData.place || '';
    const name = paymentData.name;
    
    // 숫자 필드를 숫자로 변환 (문자열로 들어올 수 있음)
    const priceValue = paymentData.price ?? 0;
    const price = typeof priceValue === 'string' ? parseFloat(priceValue) : priceValue;
    
    const originalPriceValue = paymentData.original_price ?? paymentData.originalPrice;
    const originalPrice = originalPriceValue === null || originalPriceValue === undefined
      ? null
      : typeof originalPriceValue === 'string' ? parseFloat(originalPriceValue) : originalPriceValue;
    
    const currency = paymentData.currency || 'KRW';
    
    const payerIdValue = paymentData.payer_id ?? paymentData.payerId;
    const payerId = payerIdValue === null || payerIdValue === undefined || payerIdValue === ''
      ? null
      : typeof payerIdValue === 'string' ? parseInt(String(payerIdValue), 10) : payerIdValue;
    
    const payMemberIdValue = paymentData.pay_member_id ?? paymentData.payMemberId ?? 0;
    const payMemberId = typeof payMemberIdValue === 'string' ? parseInt(String(payMemberIdValue), 10) : payMemberIdValue;
    
    const attendMemberIdsValue = paymentData.attend_member_ids ?? paymentData.attendMemberIds ?? [];
    const attendMemberIds = attendMemberIdsValue.map(id => typeof id === 'string' ? parseInt(String(id), 10) : id);
    
    const type = paymentData.type as 'PUBLIC' | 'INDIVIDUAL' | undefined;
    const exchangeRateValue = paymentData.exchange_rate ?? paymentData.exchangeRate;
    const exchangeRate = exchangeRateValue === null || exchangeRateValue === undefined
      ? null
      : typeof exchangeRateValue === 'string' ? parseFloat(exchangeRateValue) : exchangeRateValue;
    
    // 결제 날짜 (선택적, 개인 결제의 경우 환율 조회용)
    const dateValue = paymentData.date;
    const date = dateValue 
      ? (typeof dateValue === 'string' ? new Date(dateValue) : dateValue)
      : undefined;
    
    await paymentService.create(
      place,
      price,
      payMemberId,
      attendMemberIds,
      meetingId,
      userId,
      name,
      originalPrice,
      currency,
      payerId,
      type,
      exchangeRate,
      date,
    );
    res.status(201).send();
  } catch (error) {
    next(error);
  }
}

/**
 * Python: @router.get("", status_code=200)
 */
export async function getPayments(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const meetingId = parseInt(req.params.meeting_id || '0', 10);
    const payments = await paymentService.read(meetingId, userId);
    res.status(200).json(payments);
  } catch (error) {
    next(error);
  }
}

/**
 * Python: @router.put("/order", status_code=200)
 */
export async function updatePaymentOrder(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const meetingId = parseInt(req.params.meeting_id || '0', 10);
    const paymentOrderData = Array.isArray(req.body) ? (req.body as number[]) : [];
    await paymentService.updatePaymentOrder(meetingId, paymentOrderData, userId);
    res.status(200).send();
  } catch (error) {
    next(error);
  }
}

/**
 * Python: @router.put("/{payment_id}", status_code=200)
 */
export async function updatePayment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const meetingId = parseInt(req.params.meeting_id || '0', 10);
    const paymentId = parseInt(req.params.payment_id || '0', 10);
    // Python 스타일 (snake_case) 지원
    const body = req.body as Partial<PaymentData & { 
      payMemberId?: number | string; 
      attendMemberIds?: (number | string)[];
      originalPrice?: number | string | null;
      payerId?: number | string | null;
    }>;
    const place = body.place || '';
    const name = body.name;
    
    // 숫자 필드를 숫자로 변환 (문자열로 들어올 수 있음)
    const priceValue = body.price ?? 0;
    const price = typeof priceValue === 'string' ? parseFloat(priceValue) : priceValue;
    
    const originalPriceValue = body.original_price ?? body.originalPrice;
    const originalPrice = originalPriceValue === null || originalPriceValue === undefined
      ? null
      : typeof originalPriceValue === 'string' ? parseFloat(originalPriceValue) : originalPriceValue;
    
    const currency = body.currency || 'KRW';
    
    const payerIdValue = body.payer_id ?? body.payerId;
    const payerId = payerIdValue === null || payerIdValue === undefined || payerIdValue === ''
      ? null
      : typeof payerIdValue === 'string' ? parseInt(String(payerIdValue), 10) : payerIdValue;
    
    const payMemberIdValue = body.pay_member_id ?? body.payMemberId ?? 0;
    const payMemberId = typeof payMemberIdValue === 'string' ? parseInt(String(payMemberIdValue), 10) : payMemberIdValue;
    
    const attendMemberIdsValue = body.attend_member_ids ?? body.attendMemberIds ?? [];
    const attendMemberIds = attendMemberIdsValue.map(id => typeof id === 'string' ? parseInt(String(id), 10) : id);
    
    const type = body.type as 'PUBLIC' | 'INDIVIDUAL' | undefined;
    const exchangeRateValue = body.exchange_rate ?? body.exchangeRate;
    const exchangeRate = exchangeRateValue === null || exchangeRateValue === undefined
      ? null
      : typeof exchangeRateValue === 'string' ? parseFloat(exchangeRateValue) : exchangeRateValue;
    
    // 결제 날짜 (선택적, 개인 결제의 경우 환율 조회용)
    const dateValue = body.date;
    const date = dateValue 
      ? (typeof dateValue === 'string' ? new Date(dateValue) : dateValue)
      : undefined;
    
    await paymentService.update(
      paymentId,
      place,
      price,
      payMemberId,
      attendMemberIds,
      meetingId,
      userId,
      name,
      originalPrice,
      currency,
      payerId,
      type,
      exchangeRate,
      date,
    );
    res.status(200).send();
  } catch (error) {
    next(error);
  }
}

/**
 * Python: @router.delete("/{payment_id}", status_code=200)
 * 결제 삭제
 * DELETE /meeting/:meeting_id/payment/:payment_id
 */
export async function deletePayment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const meetingId = parseInt(req.params.meeting_id || '0', 10);
    const paymentId = parseInt(req.params.payment_id || '0', 10);

    if (!meetingId || !paymentId) {
      res.status(400).json({ detail: 'meeting_id and payment_id are required' });
      return;
    }

    const deletedPayment = await paymentService.delete(paymentId, meetingId, userId);
    
    res.status(200).json({
      message: 'Payment deleted successfully',
      payment: {
        id: deletedPayment.id,
        name: (deletedPayment as any).name || deletedPayment.place,
        place: deletedPayment.place,
        price: deletedPayment.price,
      },
    });
  } catch (error) {
    // 404 에러 처리
    if (error instanceof Error) {
      if (error.message === 'Payment not found' || error.message === 'Meeting not found') {
        res.status(404).json({ detail: error.message });
        return;
      }
      if (error.message === 'Payment does not belong to this meeting') {
        res.status(400).json({ detail: error.message });
        return;
      }
    }
    next(error);
  }
}

