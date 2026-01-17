import { User } from '../domains/user.domain';
import { UserRepository } from '../repositories/user.repository';
import { MeetingRepository } from '../repositories/meeting.repository';
import { MeetingService } from './meeting.service';
import {
  IdentifierAlreadyException,
  IdentifierNotFoundException,
} from '../exceptions/custom.exceptions';
import { LoginData, OauthData } from '../types/user.types';

/**
 * User Service
 * Python의 user/service.py와 동일한 로직
 */
export class UserService {
  private userRepository: UserRepository;
  private meetingRepository: MeetingRepository;
  private meetingService: MeetingService;

  constructor() {
    this.userRepository = new UserRepository();
    this.meetingRepository = new MeetingRepository();
    this.meetingService = new MeetingService();
  }

  /**
   * Python: def sign_up(self, identifier, password, name)
   */
  async signUp(identifier: string, password: string, name: string): Promise<number> {
    const user = new User(null, name, null, null, identifier, password);
    
    const existingUser = await this.userRepository.readByIdentifier(user.identifier!);
    if (existingUser) {
      user.identifierIsNotUnique();
      throw new IdentifierAlreadyException(identifier);
    }
    
    await user.passwordEncryption();
    await this.userRepository.create(user);
    return user.id!;
  }

  /**
   * Python: def sign_in(self, identifier, password)
   */
  async signIn(identifier: string, password: string): Promise<number> {
    const user = await this.userRepository.readByIdentifier(identifier);
    if (!user) {
      throw new IdentifierNotFoundException(identifier);
    }
    await user.checkPasswordMatch(password);
    return user.id!;
  }

  /**
   * Python: def oauth_signin(self, name, platform_id, platform)
   */
  async oauthSignin(name: string, platformId: string, platform: string): Promise<User | null> {
    const user = new User(null, name, platformId, platform, null, null);
    const existingUser = await this.userRepository.readByPlatformId(
      user.platform!,
      user.platformId!,
    );
    if (!existingUser) {
      return null;
    }
    return existingUser;
  }

  /**
   * Python: def oauth_signup(self, name, platform_id, platform)
   */
  async oauthSignup(name: string, platformId: string, platform: string): Promise<User> {
    const user = new User(null, name, platformId, platform, null, null);
    await this.userRepository.create(user);
    return user;
  }

  /**
   * Python: def read(self, user_id)
   */
  async read(userId: number): Promise<Omit<User, 'password'>> {
    const user = await this.userRepository.readByUserId(userId);
    if (!user) {
      throw new Error('User not found');
    }
    // Python: del user.password
    const { password: _password, ...userWithoutPassword } = user;
    return userWithoutPassword as Omit<User, 'password'>;
  }

  /**
   * Python: def edit_kakao_deposit(self, user_id, kakao_deposit_id)
   */
  async editKakaoDeposit(userId: number, kakaoDepositId: string | null): Promise<void> {
    const user = await this.userRepository.readByUserId(userId);
    if (!user) {
      throw new Error('User not found');
    }
    user.updateKakaoDepositInformation(kakaoDepositId);
    await this.userRepository.updateKakaoDeposit(user);
  }

  /**
   * Python: def edit_toss_deposit(self, user_id, bank, account_number)
   */
  async editTossDeposit(userId: number, bank: string, accountNumber: string): Promise<void> {
    const user = await this.userRepository.readByUserId(userId);
    if (!user) {
      throw new Error('User not found');
    }
    user.updateTossDepositInformation(bank, accountNumber);
    await this.userRepository.updateTossDeposit(user);
  }

  /**
   * Python: def delete(self, user_id)
   */
  async delete(userId: number): Promise<void> {
    const user = await this.userRepository.readByUserId(userId);
    if (!user) {
      throw new Error('User not found');
    }
    const meetings = await this.meetingRepository.readListByUserId(user.id!);
    for (const meeting of meetings) {
      await this.meetingService.remove(meeting.id!, user.id!);
    }
    await this.userRepository.delete(user.id!);
  }

  /**
   * Python: def create_guest(self)
   */
  async createGuest(): Promise<number> {
    const user = new User(null, null, null, null, null, null);
    // Python: type="guest"
    await this.userRepository.create(user, 'guest');
    return user.id!;
  }

  /**
   * Python: def update_guest(self, user_id, guest_update_data)
   */
  async updateGuest(
    userId: number,
    guestUpdateData: { loginData?: LoginData; oauthData?: OauthData },
  ): Promise<void> {
    const user = await this.userRepository.readByUserId(userId);
    if (!user) {
      throw new Error('User not found');
    }
    // Python 로직에 따라 login_data 또는 oauth_data 처리
    if (guestUpdateData.loginData) {
      const loginData = guestUpdateData.loginData;
      user.identifier = loginData.identifier ?? null;
      user.password = loginData.password ?? null;
      user.name = loginData.name ?? null;
      user.type = 'user';
      if (user.password) {
        await user.passwordEncryption();
      }
      await this.userRepository.update(user);
    } else if (guestUpdateData.oauthData) {
      const oauthData = guestUpdateData.oauthData;
      user.platformId = oauthData.platformId ?? null;
      user.platform = oauthData.platform ?? null;
      user.name = oauthData.name ?? null;
      user.type = 'user';
      await this.userRepository.update(user);
    }
  }
}

