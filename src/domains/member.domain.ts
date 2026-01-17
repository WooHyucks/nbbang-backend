import { Meeting } from './meeting.domain';

/**
 * Member Domain Model
 * Python의 member/domain.py와 동일한 로직
 */
export class Member {
  public id: number | null;
  public name: string;
  public leader: boolean;
  public meetingId: number;
  public amount: number;
  public tippedAmount: number;
  public depositCopyData: string | null;
  public tippedDepositCopyData: string | null;
  public tossDepositLink?: string;
  public tippedTossDepositLink?: string;
  public depositCopyText?: string;
  public tippedDepositCopyText?: string;
  public kakaoDepositLink?: string;
  public tippedKakaoDepositLink?: string;

  constructor(
    id: number | null,
    name: string,
    leader: boolean,
    meetingId: number,
    amount: number = 0,
    tippedAmount: number = 0,
    depositCopyData: string | null = null,
    tippedDepositCopyData: string | null = null,
  ) {
    this.id = id;
    this.name = name;
    this.leader = leader;
    this.meetingId = meetingId;
    this.amount = amount;
    this.tippedAmount = tippedAmount;
    this.depositCopyData = depositCopyData;
    this.tippedDepositCopyData = tippedDepositCopyData;
  }

  /**
   * Python: def delete_member_if_not_leader(self)
   */
  deleteMemberIfNotLeader(): void {
    if (this.leader) {
      throw new Error('리더 멤버는 삭제할 수 없습니다.');
    }
  }

  /**
   * Python: def add_amount(self, amount)
   */
  addAmount(amount: number): void {
    this.amount += amount;
    // Python: self.tipped_amount = math.ceil(self.amount / 10) * 10
    this.tippedAmount = Math.ceil(this.amount / 10) * 10;
  }

  /**
   * Python: def create_deposit_link(self, meeting: Meeting)
   */
  createDepositLink(meeting: Meeting): void {
    const bank = meeting.tossDepositInformation.getDecryptedBank();
    const accountNumber = meeting.tossDepositInformation.getDecryptedAccountNumber();

    if (bank && accountNumber) {
      this.tossDepositLink = this._createTossDepositLink(this.amount, bank, accountNumber);
      this.tippedTossDepositLink = this._createTossDepositLink(this.tippedAmount, bank, accountNumber);
      this.depositCopyText = this._createDepositCopyText(this.amount, bank, accountNumber);
      this.tippedDepositCopyText = this._createDepositCopyText(this.tippedAmount, bank, accountNumber);
    }

    if (meeting.kakaoDepositInformation.kakaoDepositId) {
      this.kakaoDepositLink = this._createKakaoDepositLink(
        this.amount,
        meeting.kakaoDepositInformation.kakaoDepositId,
      );
      this.tippedKakaoDepositLink = this._createKakaoDepositLink(
        this.tippedAmount,
        meeting.kakaoDepositInformation.kakaoDepositId,
      );
    }
  }

  /**
   * Python: def _create_toss_deposit_link(self, amount, bank, account_number)
   */
  private _createTossDepositLink(amount: number, bank: string, accountNumber: string): string {
    const baseUrl = 'supertoss://send';
    const params = new URLSearchParams({
      amount: Math.floor(amount).toString(),
      bank: bank,
      accountNo: accountNumber,
    });
    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * Python: def _create_kakako_deposit_link(self, amount, kakao_deposit_id)
   */
  private _createKakaoDepositLink(amount: number, kakaoDepositId: string): string {
    // Python: def _to_hex_value(value): return format(value * 524288, "x")
    const toHexValue = (value: number): string => {
      return (value * 524288).toString(16);
    };

    const baseUrl = 'https://qr.kakaopay.com/{kakao_deposit_id}{hex_amount}';
    const hexAmount = toHexValue(Math.floor(amount));
    return baseUrl.replace('{kakao_deposit_id}', kakaoDepositId).replace('{hex_amount}', hexAmount);
  }

  /**
   * Python: def _create_deposit_copy_text(self, amount, bank, account_number)
   */
  private _createDepositCopyText(amount: number, bank: string, accountNumber: string): string {
    return `${bank} ${accountNumber} ${Math.floor(amount)}원`;
  }
}

