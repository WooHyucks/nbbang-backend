import { Request, Response, NextFunction } from 'express';
import { UserService } from '../services/user.service';
import { createTokenByUserId } from '../utils/jwt.util';
import {
  getUserNameAndPlatformIdByKakaoOAuth,
  getUserNameAndPlatformIdByNaverOAuth,
  getUserNameAndPlatformIdByGoogleOAuth,
} from '../utils/oauth.util';
import { NotAgreementException } from '../exceptions/custom.exceptions';
import { GuestUpdateDataRequest, OauthDataRequest } from '../types/user.types';
import { AuthRequest } from '../middlewares/auth.middleware';
import { OauthData, DepositInformationData, GuestUpdateData } from '../types/user.types';

const userService = new UserService();

/**
 * User Controller
 * Python의 user/presentation.py와 동일한 로직
 */

/**
 * Python: @router.get("", status_code=200)
 */
export async function getUser(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const user = await userService.read(userId);
    // Express는 객체에 toJSON() 메서드가 있으면 자동으로 호출합니다
    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
}

/**
 * Python: @router.delete("", status_code=204)
 */
export async function deleteUser(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    await userService.delete(userId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

/**
 * Python: @router.post("/sign-up", status_code=201)
 */
export async function signUp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Python 스타일 (snake_case) 지원
    const body = req.body as Partial<{ identifier?: string; password?: string; name?: string }>;
    const identifier = body.identifier || '';
    const password = body.password || '';
    const name = body.name || '';

    // 기존 사용자 확인은 userService에서 처리
    const userId = await userService.signUp(identifier, password, name);
    const token = createTokenByUserId(userId);
    
    // 쿠키에 토큰 저장
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 120 * 24 * 60 * 60 * 1000, // 120일
    });
    
    res.status(201).send(token);
  } catch (error) {
    next(error);
  }
}

/**
 * Python: @router.post("/sign-in", status_code=201)
 */
export async function signIn(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Python 스타일 (snake_case) 지원
    const body = req.body as Partial<{ identifier?: string; password?: string }>;
    const identifier = body.identifier || '';
    const password = body.password || '';

    if (!identifier || !password) {
      res.status(400).json({ detail: '아이디와 비밀번호를 입력해주세요.' });
      return;
    }

    const userId = await userService.signIn(identifier, password);
    const token = createTokenByUserId(userId);
    
    // 쿠키에 토큰 저장
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 120 * 24 * 60 * 60 * 1000, // 120일
    });
    
    res.status(201).send(token);
  } catch (error) {
    next(error);
  }
}

/**
 * OAuth 로그인 공통 함수
 * Python: def oauth_login(...)
 */
async function oauthLogin(
  platform: string,
  oauthRequest: OauthDataRequest,
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    let getUserPlatformInformation: (token: string) => Promise<[string, string]>;

    if (platform === 'kakao') {
      getUserPlatformInformation = getUserNameAndPlatformIdByKakaoOAuth;
    } else if (platform === 'naver') {
      getUserPlatformInformation = getUserNameAndPlatformIdByNaverOAuth;
    } else if (platform === 'google') {
      getUserPlatformInformation = getUserNameAndPlatformIdByGoogleOAuth;
    } else {
      throw new Error('Invalid platform');
    }

    // Python 스타일 (snake_case)를 camelCase로 변환
    const oauth: OauthData = {
      token: oauthRequest.token,
      platform: oauthRequest.platform,
      platformId: oauthRequest.platform_id,
      name: oauthRequest.name,
      agreement: oauthRequest.agreement,
    };

    const isProduction = process.env.NODE_ENV === 'production';
    
    if (oauth.token) {
      const [name, platformId] = await getUserPlatformInformation(oauth.token);
      const user = await userService.oauthSignin(name, platformId, platform);
      if (!user) {
        res.status(202).json({
          platform,
          platform_id: platformId,
          name,
          agreement: false,
        });
        return;
      }
      const token = createTokenByUserId(user.id!);
      
      // 쿠키에 토큰 저장
      res.cookie('token', token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'strict' : 'lax',
        maxAge: 120 * 24 * 60 * 60 * 1000, // 120일
      });
      
      res.status(201).send(token);
    } else if (oauth.agreement && oauth.platform && oauth.platformId && oauth.name) {
      const user = await userService.oauthSignup(oauth.name, oauth.platformId, oauth.platform);
      const token = createTokenByUserId(user.id!);
      
      // 쿠키에 토큰 저장
      res.cookie('token', token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'strict' : 'lax',
        maxAge: 120 * 24 * 60 * 60 * 1000, // 120일
      });
      
      res.status(201).send(token);
    } else {
      throw new NotAgreementException();
    }
  } catch (error) {
    next(error);
  }
}

/**
 * Python: @router.post("/kakao-login", status_code=201)
 */
export async function kakaoLogin(req: Request, res: Response, next: NextFunction): Promise<void> {
  await oauthLogin('kakao', req.body as OauthDataRequest, req, res, next);
}

/**
 * Python: @router.post("/naver-login", status_code=201)
 */
export async function naverLogin(req: Request, res: Response, next: NextFunction): Promise<void> {
  await oauthLogin('naver', req.body as OauthDataRequest, req, res, next);
}

/**
 * Python: @router.post("/google-login", status_code=201)
 */
export async function googleLogin(req: Request, res: Response, next: NextFunction): Promise<void> {
  await oauthLogin('google', req.body as OauthDataRequest, req, res, next);
}

/**
 * Python: @router.put("/kakao-deposit-id", status_code=200)
 */
export async function editKakaoDeposit(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const body = req.body as Partial<DepositInformationData & { kakao_deposit_id?: string }>;
    const kakaoDepositId = body.kakaoDepositId ?? body.kakao_deposit_id ?? null;
    await userService.editKakaoDeposit(userId, kakaoDepositId);
    res.status(200).send();
  } catch (error) {
    next(error);
  }
}

/**
 * Python: @router.put("/bank-account", status_code=200)
 */
export async function editTossDeposit(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const body = req.body as Partial<DepositInformationData & { account_number?: string }>;
    const bank = body.bank || '';
    const accountNumber = body.accountNumber ?? body.account_number ?? '';
    await userService.editTossDeposit(userId, bank, accountNumber);
    res.status(200).send();
  } catch (error) {
    next(error);
  }
}

/**
 * 게스트 로그인
 */
export async function createGuest(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = await userService.createGuest();
    const token = createTokenByUserId(userId);
    
    // 쿠키에 토큰 저장
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 120 * 24 * 60 * 60 * 1000, // 120일
    });
    
    res.status(201).send(token);
  } catch (error) {
    next(error);
  }
}

/**
 * 게스트 전환
 */
export async function updateGuest(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const body = req.body as Partial<GuestUpdateDataRequest>;
    // Python 스타일 (snake_case)를 camelCase로 변환
    const guestUpdateData: GuestUpdateData = {
      loginData: body.login_data,
      oauthData: body.oauth_data,
    };
    await userService.updateGuest(userId, guestUpdateData);
    res.status(200).send();
  } catch (error) {
    next(error);
  }
}

/**
 * 로그아웃 (쿠키 삭제)
 */
export function signOut(_req: Request, res: Response, next: NextFunction): void {
  try {
    // 쿠키 삭제
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    });
    res.status(200).json({ message: 'Sign out successful' });
  } catch (error) {
    next(error);
  }
}

