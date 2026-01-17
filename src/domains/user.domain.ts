import bcrypt from 'bcrypt';
import { KakaoDepositInformation, TossDepositInformation } from '../utils/crypto.util';

/**
 * User Domain Model
 * Python의 user/domain.py와 동일한 로직
 */
export class User {
  public id: number | null;
  public name: string | null;
  public platformId: string | null;
  public platform: string | null;
  public identifier: string | null;
  public password: string | null;
  public type?: 'user' | 'guest';
  public tossDepositInformation: TossDepositInformation;
  public kakaoDepositInformation: KakaoDepositInformation;

  constructor(
    id: number | null,
    name: string | null = null,
    platformId: string | null = null,
    platform: string | null = null,
    identifier: string | null = null,
    password: string | null = null,
    bank: Buffer | string | null = null,
    accountNumber: Buffer | string | null = null,
    kakaoDepositId: string | null = null,
  ) {
    this.id = id;
    this.name = name;
    this.platformId = platformId;
    this.platform = platform;
    this.identifier = identifier;
    this.password = password;
    this.tossDepositInformation = new TossDepositInformation(bank, accountNumber);
    this.kakaoDepositInformation = new KakaoDepositInformation(kakaoDepositId);
  }

  /**
   * Python: def identifier_is_not_unique(self)
   */
  identifierIsNotUnique(): void {
    throw new Error(`Identifier ${this.identifier} is already in use`);
  }

  /**
   * Python: def password_encryption(self)
   * bcrypt를 사용한 비밀번호 암호화
   */
  async passwordEncryption(): Promise<void> {
    if (!this.password) {
      throw new Error('Password is required for encryption');
    }
    // Python: salt = bcrypt.gensalt()
    // Python: encrypted = bcrypt.hashpw(self.password.encode("utf-8"), salt)
    // Python: self.password = encrypted.decode("utf-8")
    const salt = await bcrypt.genSalt();
    const encrypted = await bcrypt.hash(this.password, salt);
    this.password = encrypted;
  }

  /**
   * Python: def check_password_match(self, password)
   */
  async checkPasswordMatch(password: string): Promise<void> {
    if (!this.password) {
      throw new Error('Password is not set');
    }
    // Python: if not bcrypt.checkpw(password.encode(), self.password.encode()):
    const isMatch = await bcrypt.compare(password, this.password);
    if (!isMatch) {
      throw new Error('Password does not match');
    }
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
   * JSON 직렬화 시 복호화된 정보를 포함
   */
  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      name: this.name,
      platform_id: this.platformId,
      platform: this.platform,
      identifier: this.identifier,
      type: this.type || 'user',
      toss_deposit_information: {
        bank: this.tossDepositInformation.getDecryptedBank(),
        account_number: this.tossDepositInformation.getDecryptedAccountNumber(),
      },
      kakao_deposit_information: {
        kakao_deposit_id: this.kakaoDepositInformation.kakaoDepositId,
      },
    };
  }
}

