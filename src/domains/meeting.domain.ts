import { v4 as uuidv4 } from 'uuid';
import { KakaoDepositInformation, TossDepositInformation } from '../utils/crypto.util';
import { User } from './user.domain';
import { MeetingUserMismatchException } from '../exceptions/custom.exceptions';

/**
 * Meeting Domain Model
 * Python의 meeting/domain.py와 동일한 로직
 */
export class Meeting {
  public id: number | null;
  public name: string;
  public date: string;
  public userId: number;
  public uuid: string | null;
  public tossDepositInformation: TossDepositInformation;
  public kakaoDepositInformation: KakaoDepositInformation;
  public isSimple: boolean;
  public simplePrice: number | null;
  public simpleMemberCount: number | null;
  public simpleMemberAmount: number | null;
  public images: string[];
  public shareLink?: string;
  public simpleTippedMemberAmount?: number;
  public tossDepositLink?: string;
  public tippedTossDepositLink?: string;
  public depositCopyText?: string;
  public tippedDepositCopyText?: string;
  public kakaoDepositLink?: string;
  public tippedKakaoDepositLink?: string;
  
  // 해외여행 정산 모드 필드
  public isTrip: boolean;
  public countryCode: string | null;
  public targetCurrency: string | null;
  public baseExchangeRate: number | null;
  public initialGonggeum: number | null;
  
  // 타임스탬프 필드
  public createdAt?: Date | string;
  public updatedAt?: Date | string;

  constructor(
    id: number | null,
    name: string,
    date: string,
    userId: number,
    uuid: string | null = null,
    bank: Buffer | string | null = null,
    accountNumber: Buffer | string | null = null,
    kakaoDepositId: string | null = null,
    isSimple: boolean = false,
    simplePrice: number | null = null,
    simpleMemberCount: number | null = null,
    simpleMemberAmount: number | null = null,
    images: string[] = [],
    isTrip: boolean = false,
    countryCode: string | null = null,
    targetCurrency: string | null = null,
    baseExchangeRate: number | null = null,
    initialGonggeum: number | null = null,
    createdAt?: Date | string,
    updatedAt?: Date | string,
  ) {
    this.id = id;
    this.name = name;
    const defaultDate = new Date().toISOString().split('T')[0];
    this.date = date || defaultDate || '';
    this.userId = userId;
    this.uuid = uuid;
    this.tossDepositInformation = new TossDepositInformation(bank, accountNumber);
    this.kakaoDepositInformation = new KakaoDepositInformation(kakaoDepositId);
    this.isSimple = isSimple;
    this.simplePrice = simplePrice;
    this.simpleMemberCount = simpleMemberCount;
    this.simpleMemberAmount = simpleMemberAmount;
    this.images = images;
    this.isTrip = isTrip;
    this.countryCode = countryCode;
    this.targetCurrency = targetCurrency || 'KRW';
    this.baseExchangeRate = baseExchangeRate || 1.0;
    this.initialGonggeum = initialGonggeum || 0;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;

    // Python: if self.is_simple and self.simple_price and self.simple_member_count:
    if (this.isSimple && this.simplePrice && this.simpleMemberCount) {
      // Python: split_price = self.simple_price // self.simple_member_count + 1 if self.simple_price % self.simple_member_count else self.simple_price / self.simple_member_count
      if (this.simplePrice % this.simpleMemberCount !== 0) {
        this.simpleMemberAmount = Math.floor(this.simplePrice / this.simpleMemberCount) + 1;
      } else {
        this.simpleMemberAmount = this.simplePrice / this.simpleMemberCount;
      }
    }
  }

  /**
   * Python: @staticmethod def create_template(user_id)
   */
  static createTemplate(userId: number): Meeting {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD 형식
    if (!dateStr) {
      throw new Error('Failed to generate date string');
    }
    return new Meeting(
      null,
      '모임명을 설정해주세요',
      dateStr,
      userId,
      uuidv4(),
    );
  }

  /**
   * Python: @staticmethod def create_simple_template(user_id)
   */
  static createSimpleTemplate(userId: number): Meeting {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    if (!dateStr) {
      throw new Error('Failed to generate date string');
    }
    return new Meeting(
      null,
      '모임명을 설정해주세요',
      dateStr,
      userId,
      uuidv4(),
      null,
      null,
      null,
      true,
      null,
      null,
    );
  }

  /**
   * Python: def load_user_deposit_information(self, user: User)
   */
  loadUserDepositInformation(user: User): void {
    this.kakaoDepositInformation = new KakaoDepositInformation(
      user.kakaoDepositInformation.kakaoDepositId,
    );
    this.tossDepositInformation = new TossDepositInformation(
      user.tossDepositInformation.bank,
      user.tossDepositInformation.accountNumber,
    );
  }

  /**
   * Python: def update_information(self, name, date)
   */
  updateInformation(name: string, date: string): void {
    this.name = name;
    const defaultDate = new Date().toISOString().split('T')[0];
    this.date = date || defaultDate || '';
  }

  /**
   * Python: def update_kakao_deposit_information(self, kakao_deposit_id)
   */
  updateKakaoDepositInformation(kakaoDepositId: string | null): void {
    this.kakaoDepositInformation = new KakaoDepositInformation(kakaoDepositId);
  }

  /**
   * Python: def update_toss_deposit_information(self, bank, account_number)
   */
  updateTossDepositInformation(bank: string | Buffer | null, accountNumber: string | Buffer | null): void {
    this.tossDepositInformation = new TossDepositInformation(bank, accountNumber);
  }

  /**
   * Python: def is_user_of_meeting(self, user_id)
   */
  isUserOfMeeting(userId: number): void {
    if (this.userId !== userId) {
      throw new MeetingUserMismatchException(userId, this.id || 0);
    }
  }

  /**
   * Python: def create_share_link(self)
   */
  createShareLink(): void {
    if (this.isSimple) {
      this.shareLink = `https://nbbang.shop/share?simple-meeting=${this.uuid}`;
    } else if (this.isTrip) {
      this.shareLink = `https://nbbang.shop/share?meeting=${this.uuid}`;
    } else {
      this.shareLink = `https://nbbang.shop/share?meeting=${this.uuid}`;
    }
  }

  /**
   * 여행 정산 결과 공유 링크 생성
   */
  createTripShareLink(): void {
    if (this.isTrip && this.uuid) {
      this.shareLink = `https://nbbang.shop/meeting/trip-page?uuid=${this.uuid}`;
    }
  }

  /**
   * Python: def create_simple_deposit_link(self)
   */
  createSimpleDepositLink(): void {
    if (!this.simplePrice || !this.simpleMemberCount) {
      return;
    }

    // Python: deposit_amount = self.simple_price // self.simple_member_count
    const depositAmount = Math.floor(this.simplePrice / this.simpleMemberCount);
    // Python: tipped_deposit_amount = math.ceil((self.simple_price / self.simple_member_count) / 10) * 10
    const tippedDepositAmount = Math.ceil((this.simplePrice / this.simpleMemberCount) / 10) * 10;
    this.simpleTippedMemberAmount = tippedDepositAmount;

    const bank = this.tossDepositInformation.getDecryptedBank();
    const accountNumber = this.tossDepositInformation.getDecryptedAccountNumber();

    if (bank && accountNumber) {
      this.tossDepositLink = this._createTossDepositLink(depositAmount, bank, accountNumber);
      this.tippedTossDepositLink = this._createTossDepositLink(tippedDepositAmount, bank, accountNumber);
      this.depositCopyText = this._createDepositCopyText(depositAmount, bank, accountNumber);
      this.tippedDepositCopyText = this._createDepositCopyText(tippedDepositAmount, bank, accountNumber);
    }

    if (this.kakaoDepositInformation.kakaoDepositId) {
      this.kakaoDepositLink = this._createKakaoDepositLink(depositAmount, this.kakaoDepositInformation.kakaoDepositId);
      this.tippedKakaoDepositLink = this._createKakaoDepositLink(tippedDepositAmount, this.kakaoDepositInformation.kakaoDepositId);
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

  /**
   * JSON 직렬화 시 복호화된 정보를 포함
   */
  toJSON(): Record<string, unknown> {
    // meetingType 결정: trip > simple > normal
    let meetingType: 'normal' | 'simple' | 'trip' = 'normal';
    if (this.isTrip) {
      meetingType = 'trip';
    } else if (this.isSimple) {
      meetingType = 'simple';
    }

    return {
      id: this.id,
      name: this.name,
      date: this.date,
      user_id: this.userId,
      uuid: this.uuid,
      meetingType: meetingType,
      toss_deposit_information: {
        bank: this.tossDepositInformation.getDecryptedBank(),
        account_number: this.tossDepositInformation.getDecryptedAccountNumber(),
      },
      kakao_deposit_information: {
        kakao_deposit_id: this.kakaoDepositInformation.kakaoDepositId,
      },
      is_simple: this.isSimple,
      simple_price: this.simplePrice,
      simple_member_count: this.simpleMemberCount,
      simple_member_amount: this.simpleMemberAmount,
      images: this.images,
      share_link: this.shareLink,
      simple_tipped_member_amount: this.simpleTippedMemberAmount,
      toss_deposit_link: this.tossDepositLink,
      tipped_toss_deposit_link: this.tippedTossDepositLink,
      deposit_copy_text: this.depositCopyText,
      tipped_deposit_copy_text: this.tippedDepositCopyText,
      kakao_deposit_link: this.kakaoDepositLink,
      tipped_kakao_deposit_link: this.tippedKakaoDepositLink,
      is_trip: this.isTrip,
      country_code: this.countryCode,
      target_currency: this.targetCurrency,
      base_exchange_rate: this.baseExchangeRate,
      initial_gonggeum: this.initialGonggeum,
      total_gonggeum_used: (this as any).totalGonggeumUsed || 0,
      remaining_gonggeum_krw: (this as any).remainingGonggeumKRW || 0,
      remaining_gonggeum_foreign: (this as any).remainingGonggeum || 0,
      created_at: this.createdAt,
      updated_at: this.updatedAt,
    };
  }
}

// DateHelper는 더 이상 사용되지 않음 - 로직을 직접 구현으로 변경

