import { Calculate } from '../domains/calculate.domain';
import { Member } from '../domains/member.domain';
import { Payment } from '../domains/payment.domain';

/**
 * Calculate Service
 * Python의 calculate/domain.py의 Calculate 클래스를 그대로 사용
 * 별도 Service 레이어 없이 Domain 모델을 직접 사용
 */

export function splitPayments(members: Member[], payments: Payment[]): void {
  const calculate = new Calculate(members, payments);
  calculate.splitPayments();
}

export function splitMembers(members: Member[], payments: Payment[]): void {
  const calculate = new Calculate(members, payments);
  calculate.splitMembers();
}

