import { Member } from './member.domain';
import { Payment } from './payment.domain';

/**
 * Calculate Domain Model
 * Python의 calculate/domain.py와 동일한 로직
 * N빵 정산 계산 알고리즘
 */
export class Calculate {
  private members: Member[];
  private payments: Payment[];

  constructor(members: Member[], payments: Payment[]) {
    this.members = members;
    this.payments = payments;
  }

  /**
   * Python: def split_payments(self)
   */
  splitPayments(): void {
    for (const payment of this.payments) {
      payment.setSplitPrice();
      payment.setAttendMembersName(this.members);
      payment.setPayMemberName(this.members);
    }
  }

  /**
   * Python: def split_members(self)
   */
  splitMembers(): void {
    for (const payment of this.payments) {
      payment.setSplitPrice();
      this._reducePayMemberAmount(payment);
      this._addAttendMemberAmount(payment);
    }
  }

  /**
   * Python: def _reduce_pay_member_amount(self, payment: Payment)
   */
  private _reducePayMemberAmount(payment: Payment): void {
    for (const member of this.members) {
      if (member.id === payment.payMemberId) {
        member.addAmount(-payment.price);
      }
    }
  }

  /**
   * Python: def _add_attend_member_amount(self, payment: Payment)
   */
  private _addAttendMemberAmount(payment: Payment): void {
    for (const member of this.members) {
      for (const memberId of payment.attendMemberIds) {
        if (memberId === member.id) {
          member.addAmount(payment.splitPrice!);
        }
      }
    }
  }
}



