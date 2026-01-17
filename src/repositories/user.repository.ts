import { prisma } from '../utils/prisma.util';
import { User } from '../domains/user.domain';

/**
 * User Repository
 * Python의 user/repository.py와 동일한 로직
 */
export class UserRepository {
  /**
   * Python: def create(self, user: User)
   */
  async create(user: User, type: 'user' | 'guest' = 'user'): Promise<void> {
    const userModel = await prisma.user.create({
      data: {
        name: user.name,
        platformId: user.platformId,
        platform: user.platform,
        identifier: user.identifier,
        password: user.password,
        accountNumber: user.tossDepositInformation.accountNumber instanceof Buffer
          ? user.tossDepositInformation.accountNumber
          : null,
        bank: user.tossDepositInformation.bank instanceof Buffer
          ? user.tossDepositInformation.bank
          : null,
        kakaoDepositId: user.kakaoDepositInformation.kakaoDepositId,
        type: type,
      },
    });
    user.id = userModel.id;
  }

  /**
   * Python: def delete(self, user_id)
   */
  async delete(userId: number): Promise<void> {
    await prisma.user.delete({
      where: { id: userId },
    });
  }

  /**
   * Python: def read_by_identifier(self, identifier)
   */
  async readByIdentifier(identifier: string): Promise<User | null> {
    const userModel = await prisma.user.findFirst({
      where: { identifier },
    });

    if (!userModel) {
      return null;
    }

    const user = new User(
      userModel.id,
      userModel.name,
      userModel.platformId,
      userModel.platform,
      userModel.identifier,
      userModel.password,
      userModel.bank,
      userModel.accountNumber,
      userModel.kakaoDepositId,
    );
    user.type = (userModel.type as 'user' | 'guest') || 'user';
    return user;
  }

  /**
   * Python: def read_by_platform_id(self, platform, platform_id)
   */
  async readByPlatformId(platform: string, platformId: string): Promise<User | null> {
    const userModel = await prisma.user.findFirst({
      where: {
        platform,
        platformId,
      },
    });

    if (!userModel) {
      return null;
    }

    const user = new User(
      userModel.id,
      userModel.name,
      userModel.platformId,
      userModel.platform,
      userModel.identifier,
      userModel.password,
      userModel.bank,
      userModel.accountNumber,
      userModel.kakaoDepositId,
    );
    user.type = (userModel.type as 'user' | 'guest') || 'user';
    return user;
  }

  /**
   * Python: def read_by_user_id(self, user_id)
   */
  async readByUserId(userId: number): Promise<User | null> {
    const userModel = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!userModel) {
      return null;
    }

    const user = new User(
      userModel.id,
      userModel.name,
      userModel.platformId,
      userModel.platform,
      userModel.identifier,
      userModel.password,
      userModel.bank,
      userModel.accountNumber,
      userModel.kakaoDepositId,
    );
    user.type = (userModel.type as 'user' | 'guest') || 'user';
    return user;
  }

  /**
   * Python: def update_toss_deposit(self, user: User)
   */
  async updateTossDeposit(user: User): Promise<void> {
    const bank = user.tossDepositInformation.bank instanceof Buffer
      ? user.tossDepositInformation.bank
      : null;
    const accountNumber = user.tossDepositInformation.accountNumber instanceof Buffer
      ? user.tossDepositInformation.accountNumber
      : null;

    await prisma.user.update({
      where: { id: user.id! },
      data: {
        bank,
        accountNumber,
      },
    });
  }

  /**
   * Python: def update_kakao_deposit(self, user: User)
   */
  async updateKakaoDeposit(user: User): Promise<void> {
    await prisma.user.update({
      where: { id: user.id! },
      data: {
        kakaoDepositId: user.kakaoDepositInformation.kakaoDepositId,
      },
    });
  }

  /**
   * User 정보 업데이트 (게스트 전환 등)
   */
  async update(user: User): Promise<void> {
    await prisma.user.update({
      where: { id: user.id! },
      data: {
        name: user.name,
        platformId: user.platformId,
        platform: user.platform,
        identifier: user.identifier,
        password: user.password,
        type: user.type || (user.platformId || user.identifier ? 'user' : 'guest'),
      },
    });
  }
}

