import { Member } from './member.domain';

/**
 * Payment Domain Model
 * Python의 payment/domain.py와 동일한 로직
 */
export class Payment {
  public id: number | null;
  public name: string; // 지출 내역명
  public place: string; // 장소 (하위 호환성)
  public price: number; // 최종 원화 환산 금액
  public originalPrice: number | null; // 현지 통화 금액 (외화인 경우)
  public currency: string; // ISO 4217 통화 코드
  public exchangeRate: number | null; // 적용된 환율
  public payerId: number | null; // Nullable: null이면 '공금'으로 결제
  public payMemberId: number;
  public attendMemberIds: number[]; // Python에서는 문자열이었지만, Prisma에서 Int[]로 개선
  public type: 'PUBLIC' | 'INDIVIDUAL'; // 'PUBLIC' (공금) 또는 'INDIVIDUAL' (개인)
  public meetingId: number;
  public splitPrice?: number;
  public attendMember?: string[];
  public payMember?: string;

  constructor(
    id: number | null,
    place: string,
    price: number,
    payMemberId: number,
    attendMemberIds: number[],
    meetingId: number,
    name?: string,
    originalPrice?: number | null,
    currency?: string,
    exchangeRate?: number | null,
    payerId?: number | null,
    type?: 'PUBLIC' | 'INDIVIDUAL',
  ) {
    this.id = id;
    this.name = name || place; // name이 없으면 place 사용
    this.place = place;
    this.price = price;
    this.originalPrice = originalPrice || null;
    this.currency = currency || 'KRW';
    this.exchangeRate = exchangeRate || null;
    this.payerId = payerId || null;
    this.payMemberId = payMemberId;
    this.attendMemberIds = attendMemberIds;
    this.type = type || (payerId === null ? 'PUBLIC' : 'INDIVIDUAL'); // payerId가 null이면 PUBLIC
    this.meetingId = meetingId;
  }

  /**
   * Python: def check_in_member(self, member: Member)
   */
  checkInMember(member: Member): void {
    for (const attendMemberId of this.attendMemberIds) {
      if (member.id === attendMemberId) {
        throw new Error('결제내역에 포함된 멤버는 삭제할 수 없습니다.');
      }
    }
  }

  /**
   * Python: def set_split_price(self)
   */
  setSplitPrice(): void {
    const attendMembersCount = this.attendMemberIds.length;
    if (this.attendMemberIds.length === 0) {
      this.splitPrice = 0;
      return;
    }
    // Python: split_price = self.price // attend_members_count + 1 if self.price % attend_members_count else self.price / attend_members_count
    if (this.price % attendMembersCount !== 0) {
      this.splitPrice = Math.floor(this.price / attendMembersCount) + 1;
    } else {
      this.splitPrice = this.price / attendMembersCount;
    }
  }

  /**
   * Python: def set_attend_members_name(self, members: list[Member])
   */
  setAttendMembersName(members: Member[]): void {
    this.attendMember = [];
    for (const member of members) {
      for (const attendMemberId of this.attendMemberIds) {
        if (member.id === attendMemberId) {
          this.attendMember.push(member.name);
        }
      }
    }
  }

  /**
   * Python: def set_pay_member_name(self, members: list[Member])
   */
  setPayMemberName(members: Member[]): void {
    for (const member of members) {
      if (member.id === this.payMemberId) {
        this.payMember = member.name;
      }
    }
  }
}



