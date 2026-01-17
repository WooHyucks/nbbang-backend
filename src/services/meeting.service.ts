import { Meeting } from '../domains/meeting.domain';
import { Member } from '../domains/member.domain';
import { Payment } from '../domains/payment.domain';
import { MeetingRepository } from '../repositories/meeting.repository';
import { MemberRepository } from '../repositories/member.repository';
import { PaymentRepository } from '../repositories/payment.repository';
import { ContributionRepository } from '../repositories/contribution.repository';
import { UserRepository } from '../repositories/user.repository';
import { ImageRepository } from '../repositories/image.repository';
import { Calculate } from '../domains/calculate.domain';
import {
  IncompleteShareException,
  SharePageNotMeetingException,
} from '../exceptions/custom.exceptions';
import { SimpleMeetingRequest } from '../types/meeting.types';
import { UploadFile } from '../types/upload.types';
import { v4 as uuidv4 } from 'uuid';
import { CurrencyService } from './currency.service';
import { aesDecrypt } from '../utils/crypto.util';

/**
 * Meeting Service
 * Python의 meeting/service.py와 동일한 로직
 */
export class MeetingService {
  private imageRepository: ImageRepository;
  private meetingRepository: MeetingRepository;
  private memberRepository: MemberRepository;
  private paymentRepository: PaymentRepository;
  private contributionRepository: ContributionRepository;
  private userRepository: UserRepository;
  private currencyService: CurrencyService;

  constructor() {
    this.imageRepository = new ImageRepository();
    this.meetingRepository = new MeetingRepository();
    this.memberRepository = new MemberRepository();
    this.paymentRepository = new PaymentRepository();
    this.contributionRepository = new ContributionRepository();
    this.userRepository = new UserRepository();
    this.currencyService = new CurrencyService();
  }

  /**
   * Python: def add(self, user_id)
   */
  async add(userId: number): Promise<Meeting> {
    const user = await this.userRepository.readByUserId(userId);
    if (!user) {
      throw new Error('User not found');
    }
    const meeting = Meeting.createTemplate(userId);
    meeting.loadUserDepositInformation(user);
    await this.meetingRepository.create(meeting);
    return meeting;
  }

  /**
   * Python: def create_simple_meeting(self, user_id)
   */
  async createSimpleMeeting(userId: number): Promise<Meeting> {
    const user = await this.userRepository.readByUserId(userId);
    if (!user) {
      throw new Error('User not found');
    }
    const meeting = Meeting.createSimpleTemplate(userId);
    meeting.loadUserDepositInformation(user);
    await this.meetingRepository.create(meeting);
    return meeting;
  }

  /**
   * 해외여행 정산 모드 모임 생성
   * 
   * @param userId - 사용자 ID
   * @param countryCode - ISO 3166-1 alpha-2 국가 코드 (예: "JP", "US")
   * @param totalForeign - 총 외화 금액 (baseExchangeRate 자동 계산용, 선택사항)
   * @param contributions - 멤버별 초기 공금 정보 (선택사항)
   * @returns 생성된 Meeting 객체
   */
  async createTripMeeting(
    userId: number,
    countryCode: string,
    totalForeign?: number,
    contributions?: Array<{ memberId: number; amountKRW: number; name?: string }>,
    advancePayments?: Array<{ name: string; price: number; payMemberName: string }>,
  ): Promise<Meeting> {
    try {
      const user = await this.userRepository.readByUserId(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // 국가 코드로 통화 코드 매핑
      const currencyMap: Record<string, string> = {
        'JP': 'JPY',
        'US': 'USD',
        'CN': 'CNY',
        'GB': 'GBP',
        'EU': 'EUR',
        'TH': 'THB',
        'VN': 'VND',
        'PH': 'PHP',
        'SG': 'SGD',
        'MY': 'MYR',
        'ID': 'IDR',
        'AU': 'AUD',
        'NZ': 'NZD',
        'CA': 'CAD',
        'TW': 'TWD',  // 대만
        'KR': 'KRW',
      };

      const upperCountryCode = countryCode.toUpperCase();
      const targetCurrency = currencyMap[upperCountryCode] || 'KRW';
      
      // 지원하지 않는 국가 코드인 경우 경고
      if (!currencyMap[upperCountryCode]) {
      }

      // contributions가 있으면 총 KRW 계산
      let totalKRW = 0;
      if (contributions && contributions.length > 0) {
        totalKRW = contributions.reduce((sum, c) => sum + c.amountKRW, 0);
      }

      // 환율 계산
      let baseExchangeRate = 1.0;
      let initialGonggeum = 0;

      // 국내 여행(KR) 예외 처리: baseExchangeRate를 무조건 1.0으로 설정
      if (upperCountryCode === 'KR') {
        baseExchangeRate = 1.0;
        
        if (contributions && contributions.length > 0) {
          initialGonggeum = totalKRW;
        }
      } else if (contributions && contributions.length > 0) {
        // contributions가 있으면 totalKRW를 initialGonggeum으로 설정
        initialGonggeum = totalKRW;
        
        // totalForeign가 제공되면 baseExchangeRate 자동 계산
        // totalForeign는 외화 금액, totalKRW는 원화 금액
        // baseExchangeRate는 "1 외화 = ? 원화" 형태로 저장해야 함
        if (totalForeign && totalForeign > 0 && totalKRW > 0) {
          baseExchangeRate = totalKRW / totalForeign; // 1 외화 = ? 원화
        } else if (targetCurrency !== 'KRW') {
          // totalForeign가 없으면 CurrencyService로 환율 조회 (DB 캐시 우선)
          try {
            baseExchangeRate = await this.currencyService.getRate(targetCurrency);
          } catch (error) {
            baseExchangeRate = 1.0;
          }
        }
      } else {
        // contributions가 없으면 CurrencyService로 환율만 조회 (DB 캐시 우선)
        if (targetCurrency !== 'KRW') {
          try {
            baseExchangeRate = await this.currencyService.getRate(targetCurrency);
          } catch (error) {
            baseExchangeRate = 1.0;
          }
        }
      }

      // Meeting 생성
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];
      if (!dateStr) {
        throw new Error('Failed to generate date string');
      }
      
      const meeting = new Meeting(
        null,
        '모임명을 설정해주세요',
        dateStr,
        userId,
        uuidv4(),
        null,
        null,
        null,
        false, // isSimple
        null,
        null,
        null,
        [],
        true, // isTrip
        countryCode.toUpperCase(),
        targetCurrency,
        baseExchangeRate,
        initialGonggeum,
      );

      meeting.loadUserDepositInformation(user);
      
      await this.meetingRepository.create(meeting);

      // Step A: contributions가 있으면 멤버와 Contribution 생성
      const memberNameToIdMap = new Map<string, number>(); // 멤버 이름 -> ID 매핑
      
      if (contributions && contributions.length > 0 && meeting.id) {
        
        for (let i = 0; i < contributions.length; i++) {
          const contribution = contributions[i];
          if (!contribution) continue;
          
          const memberName = contribution.name || `멤버 ${i + 1}`;
          const isLeader = i === 0; // 첫 번째 멤버를 리더로 설정
          
          // Member 생성
          const member = new Member(
            null,
            memberName,
            isLeader,
            meeting.id,
          );
          
          await this.memberRepository.create(member);
          
          // 멤버 이름 -> ID 매핑 저장
          if (member.id) {
            memberNameToIdMap.set(memberName, member.id);
          }
          
          // Contribution 생성
          if (member.id && contribution.amountKRW) {
            await this.contributionRepository.create(
              member.id,
              meeting.id,
              contribution.amountKRW,
            );
          }
        }
      }

      // Step B: advance_payments가 있으면 선결제 Payment 생성
      if (advancePayments && advancePayments.length > 0 && meeting.id) {
        
        // 모든 멤버 ID 배열 생성 (attendMemberIds용)
        const allMemberIds = Array.from(memberNameToIdMap.values());
        
        if (allMemberIds.length === 0) {
          throw new Error('Cannot create advance payments: no members found. Please create members first with contributions.');
        }
        
        for (const advancePayment of advancePayments) {
          // pay_member_name으로 멤버 ID 찾기
          const payMemberId = memberNameToIdMap.get(advancePayment.payMemberName);
          
          if (!payMemberId) {
            throw new Error(`Member not found: ${advancePayment.payMemberName}. Please ensure the member name matches one in contributions.`);
          }
          
          // Payment 생성 (선결제: type=INDIVIDUAL, currency=KRW, exchangeRate=1.0)
          const payment = new Payment(
            null,
            advancePayment.name, // place로 사용 (하위 호환성)
            Math.round(advancePayment.price), // 원화 금액
            payMemberId,
            allMemberIds, // 모든 멤버가 참여
            meeting.id,
            advancePayment.name, // name 필드
            null, // originalPrice (KRW이므로 null)
            'KRW', // currency
            1.0, // exchangeRate
            payMemberId, // payerId
            'INDIVIDUAL', // type
          );
          
          await this.paymentRepository.create(payment);
        }
      }
      
      return meeting;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to create trip meeting: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Python: def update_simple_meeting_data(self, meeting_id, user_id, simple_meeting_data_request)
   */
  async updateSimpleMeetingData(
    meetingId: number,
    userId: number,
    simpleMeetingDataRequest: SimpleMeetingRequest,
  ): Promise<void> {
    const meeting = await this.meetingRepository.readById(meetingId);
    if (!meeting) {
      throw new Error('Meeting not found');
    }
    meeting.isUserOfMeeting(userId);
    await this.meetingRepository.updateSimpleMeetingData(meetingId, simpleMeetingDataRequest);
  }

  /**
   * Python: def edit_information(self, id, user_id, name, date)
   */
  async editInformation(id: number, userId: number, name: string, date: string): Promise<void> {
    const meeting = await this.meetingRepository.readById(id);
    if (!meeting) {
      throw new Error('Meeting not found');
    }
    meeting.isUserOfMeeting(userId);
    meeting.updateInformation(name, date);
    await this.meetingRepository.updateInformation(meeting);
  }

  /**
   * Python: def edit_kakao_deposit(self, id, user_id, kakao_deposit_id)
   */
  async editKakaoDeposit(id: number, userId: number, kakaoDepositId: string | null): Promise<void> {
    const meeting = await this.meetingRepository.readById(id);
    if (!meeting) {
      throw new Error('Meeting not found');
    }
    meeting.isUserOfMeeting(userId);
    meeting.updateKakaoDepositInformation(kakaoDepositId);
    await this.meetingRepository.updateKakaoDeposit(meeting);
  }

  /**
   * Python: def edit_toss_deposit(self, id, user_id, bank, account_number)
   */
  async editTossDeposit(id: number, userId: number, bank: string, accountNumber: string): Promise<void> {
    const meeting = await this.meetingRepository.readById(id);
    if (!meeting) {
      throw new Error('Meeting not found');
    }
    meeting.isUserOfMeeting(userId);
    meeting.updateTossDepositInformation(bank, accountNumber);
    await this.meetingRepository.updateTossDeposit(meeting);
  }

  /**
   * 공금 추가 기능
   * 여행 도중 추가로 공금을 걷을 때 사용
   * 
   * @param meetingId - 모임 ID
   * @param userId - 요청한 사용자 ID (권한 확인용)
   * @param amount - 1인당 추가할 금액 (KRW)
   * @param memberIds - 돈을 낸 멤버들 ID 배열
   */
  async addBudget(meetingId: number, userId: number, amount: number, memberIds: number[]): Promise<void> {
    // 1. 모임 존재 및 권한 확인
    const meeting = await this.meetingRepository.readById(meetingId);
    if (!meeting) {
      throw new Error('Meeting not found');
    }
    meeting.isUserOfMeeting(userId);

    // 2. 멤버 ID 유효성 검증
    if (!memberIds || memberIds.length === 0) {
      throw new Error('memberIds is required and must not be empty');
    }

    // 3. 각 멤버에 대해 기여금 추가
    for (const memberId of memberIds) {
      // 멤버가 해당 모임에 속하는지 확인
      const member = await this.memberRepository.readById(memberId);
      if (!member || member.meetingId !== meetingId) {
        throw new Error(`Member ${memberId} not found or does not belong to this meeting`);
      }

      // 기여금 추가 (기존 금액에 더하기)
      await this.contributionRepository.addAmount(memberId, meetingId, amount);
    }
  }

  /**
   * 외화 기준 공금 추가 기능
   * 여행 도중 외화로 추가 공금을 걷을 때 사용
   * 외화 금액을 받아서 baseExchangeRate로 원화 환산 후 Contribution에 저장
   * 
   * @param meetingId - 모임 ID
   * @param userId - 요청한 사용자 ID (권한 확인용)
   * @param foreignAmount - 추가할 외화 금액 (예: TWD)
   * @param memberIds - 돈을 낸 멤버들 ID 배열
   */
  async addBudgetWithForeignCurrency(meetingId: number, userId: number, foreignAmount: number, memberIds: number[]): Promise<void> {
    // 1. 모임 존재 및 권한 확인
    const meeting = await this.meetingRepository.readById(meetingId);
    if (!meeting) {
      throw new Error('Meeting not found');
    }
    meeting.isUserOfMeeting(userId);

    // 2. 해외여행 모임인지 확인
    if (!meeting.isTrip) {
      throw new Error('This meeting is not a trip meeting');
    }

    // 3. baseExchangeRate 조회
    const baseExchangeRate = meeting.baseExchangeRate || 1.0;
    if (!baseExchangeRate || baseExchangeRate <= 0) {
      throw new Error('Invalid baseExchangeRate. Please set exchange rate for this meeting.');
    }

    // 4. 원화 환산: amountKRW = Math.round(foreignAmount * baseExchangeRate)
    const amountKRW = Math.round(foreignAmount * baseExchangeRate);

    // 5. 멤버 ID 유효성 검증
    if (!memberIds || memberIds.length === 0) {
      throw new Error('memberIds is required and must not be empty');
    }

    // 6. 각 멤버에 대해 기여금 추가
    for (const memberId of memberIds) {
      // 멤버가 해당 모임에 속하는지 확인
      const member = await this.memberRepository.readById(memberId);
      if (!member || member.meetingId !== meetingId) {
        throw new Error(`Member ${memberId} not found or does not belong to this meeting`);
      }

      // 기여금 추가 (기존 금액에 더하기)
      // Contribution 테이블은 KRW 저장이 기본이므로 환산된 amountKRW를 저장
      await this.contributionRepository.addAmount(memberId, meetingId, amountKRW);
    }
  }

  /**
   * Python: def remove(self, id, user_id)
   */
  async remove(id: number, userId: number): Promise<void> {
    const meeting = await this.meetingRepository.readById(id);
    if (!meeting) {
      throw new Error('Meeting not found');
    }
    meeting.isUserOfMeeting(userId);
    const delImages = await this.meetingRepository.readImages(id);
    if (delImages) {
      for (const image of delImages) {
        await this.imageRepository.deleteImage(image);
      }
    }
    if (meeting.isSimple) {
      await this.meetingRepository.delete(meeting);
    } else {
      await this.meetingRepository.delete(meeting);
      await this.memberRepository.deleteByMeetingId(meeting.id!);
      await this.paymentRepository.deleteByMeetingId(meeting.id!);
    }
  }

  /**
   * Python: def read(self, id, user_id)
   */
  async read(id: number, userId: number): Promise<Meeting> {
    const meeting = await this.meetingRepository.readById(id);
    if (!meeting) {
      throw new Error('Meeting not found');
    }
    meeting.isUserOfMeeting(userId);
    
    // 유저의 최신 입금 정보를 로드 (유저 정보가 변경되었을 수 있음)
    const user = await this.userRepository.readByUserId(userId);
    if (user) {
      meeting.loadUserDepositInformation(user);
    }
    
    meeting.createShareLink();
    
    // 해외여행 모드인 경우 공금 잔액 계산 및 여행 정산 링크 생성
    if (meeting.isTrip) {
      await this._calculateGonggeumBalance(meeting);
      meeting.createTripShareLink();
    }
    
    return meeting;
  }

  /**
   * 공금 잔액 계산
   * 
   * @param meeting - Meeting 객체
   */
  private async _calculateGonggeumBalance(meeting: Meeting): Promise<void> {
    const payments = await this.paymentRepository.readListByMeetingId(meeting.id!);
    
    // 공금으로 결제한 금액 합계 계산 (payerId가 null인 경우)
    let totalGonggeumUsed = 0;
    for (const payment of payments) {
      if (payment.payerId === null) {
        // 공금으로 결제한 경우, 원화 환산 금액을 합산
        totalGonggeumUsed += payment.price;
      }
    }
    
    // 공금 잔액 = 초기 공금 - 사용한 공금
    const remainingGonggeumKRW = (meeting.initialGonggeum || 0) - totalGonggeumUsed;
    
    // 외화 잔액 계산 (원화를 외화로 환산)
    // baseExchangeRate는 "1 외화 = ? 원화" 형태이므로, 원화를 외화로 변환하려면 나눠야 함
    let remainingGonggeumForeign = remainingGonggeumKRW;
    if (meeting.targetCurrency && meeting.targetCurrency !== 'KRW' && meeting.baseExchangeRate) {
      remainingGonggeumForeign = remainingGonggeumKRW / meeting.baseExchangeRate;
    }
    
    // Meeting 객체에 공금 잔액 정보 추가
    (meeting as any).totalGonggeumUsed = totalGonggeumUsed;
    (meeting as any).remainingGonggeum = remainingGonggeumForeign;
    (meeting as any).remainingGonggeumKRW = remainingGonggeumKRW;
  }

  /**
   * Python: def read_simple_meeting(self, meeting_id, user_id)
   */
  async readSimpleMeeting(meetingId: number, userId: number): Promise<Meeting> {
    const meeting = await this.meetingRepository.readById(meetingId);
    if (!meeting) {
      throw new Error('Meeting not found');
    }
    meeting.isUserOfMeeting(userId);
    
    // 유저의 최신 입금 정보를 로드 (유저 정보가 변경되었을 수 있음)
    const user = await this.userRepository.readByUserId(userId);
    if (user) {
      meeting.loadUserDepositInformation(user);
    }
    
    meeting.createShareLink();
    if (meeting.simpleMemberCount && meeting.simplePrice) {
      meeting.createSimpleDepositLink();
    }
    return meeting;
  }

  /**
   * Python: def read_meetings(self, user_id)
   */
  async readMeetings(userId: number): Promise<Meeting[]> {
    return await this.meetingRepository.readListByUserId(userId);
  }

  /**
   * Python: def read_share_page(self, uuid)
   */
  async readSharePage(uuid: string): Promise<any> {
    const meeting = await this.meetingRepository.readByUuid(uuid);
    if (!meeting) {
      throw new SharePageNotMeetingException();
    }
    if (meeting.isSimple) {
      if (!meeting.simplePrice || !meeting.simpleMemberCount) {
        throw new IncompleteShareException();
      }
      meeting.createSimpleDepositLink();
      return { meeting };
    } else {
      const members = await this.memberRepository.readListByMeetingId(meeting.id!);
      const payments = await this.paymentRepository.readListByMeetingId(meeting.id!);
      if (!members || !payments || members.length === 0 || payments.length === 0) {
        throw new IncompleteShareException();
      }

      const calculate = new Calculate(members, payments);
      calculate.splitPayments();
      calculate.splitMembers();

      for (const member of members) {
        member.createDepositLink(meeting);
      }
      return { meeting, members, payments };
    }
  }

  /**
   * Python: async def upload_images(self, images: list[UploadFile])
   */
  async uploadImages(images: UploadFile[]): Promise<string[]> {
    const result: string[] = [];
    for (const image of images) {
      // Python: image.filename = f"{uuid.uuid4()}.webp"
      const filename = `${uuidv4()}.webp`;
      await this.imageRepository.uploadImage(filename, image.buffer);
      result.push(filename);
    }
    return result;
  }

  /**
   * Python: def update_images(self, id, user_id, images)
   */
  async updateImages(id: number, userId: number, images: string[]): Promise<void> {
    const meeting = await this.meetingRepository.readById(id);
    if (!meeting) {
      throw new Error('Meeting not found');
    }
    meeting.isUserOfMeeting(userId);
    const preImages = await this.meetingRepository.readImages(id);
    if (preImages) {
      for (const preImage of preImages) {
        if (!images.includes(preImage)) {
          await this.imageRepository.deleteImage(preImage);
        }
      }
    }
    await this.meetingRepository.updateImages(id, images);
  }

  /**
   * 해외여행 정산 결과 조회 (선결제 포함 통합 정산)
   * 
   * @param meetingId - 모임 ID
   * @param userId - 사용자 ID
   * @returns 정산 결과 객체
   */
  async getTripSettlementResult(meetingId: number, userId: number): Promise<any> {
    const meeting = await this.meetingRepository.readById(meetingId);
    if (!meeting) {
      throw new Error('Meeting not found');
    }
    meeting.isUserOfMeeting(userId);

    if (!meeting.isTrip) {
      throw new Error('This meeting is not a trip meeting');
    }

    const members = await this.memberRepository.readListByMeetingId(meetingId);
    const allPayments = await this.paymentRepository.readListByMeetingId(meetingId);
    const contributions = await this.contributionRepository.readListByMeetingId(meetingId);

    // 공금으로 결제한 Payment (type === 'PUBLIC' 또는 payer_id === null)
    const publicPayments = allPayments.filter(p => 
      (p as any).type === 'PUBLIC' || p.payerId === null
    );

    // 선결제(Advance Payment): currency === 'KRW'이고 type === 'INDIVIDUAL'인 결제
    const advancePayments = allPayments.filter(p => {
      const paymentType = (p as any).type || (p.payerId === null ? 'PUBLIC' : 'INDIVIDUAL');
      return paymentType === 'INDIVIDUAL' && p.currency === 'KRW';
    });

    // Step A. 전체 비용 계산
    const totalPublicSpent = publicPayments.reduce((sum, p) => sum + p.price, 0);
    const totalIndividualSpent = advancePayments.reduce((sum, p) => sum + p.price, 0);
    const grandTotalCost = totalPublicSpent + totalIndividualSpent;
    const memberCount = members.length;
    const perPersonCost = memberCount > 0 ? grandTotalCost / memberCount : 0;

    // 공금 현황 계산 (선결제는 공금 잔액에서 차감하지 않음)
    const initialGonggeum = meeting.initialGonggeum || 0;
    const remainingGonggeumKRW = initialGonggeum - totalPublicSpent;
    const remainingGonggeumForeign = remainingGonggeumKRW * (meeting.baseExchangeRate || 1.0);
    const gonggeumStatus: 'SURPLUS' | 'DEFICIT' = remainingGonggeumKRW >= 0 ? 'SURPLUS' : 'DEFICIT';

    // B. 최종 송금 정보
    // 총무(리더) 정보
    const leader = members.find(m => m.leader);
    if (!leader) {
      throw new Error('Leader not found');
    }

    // 유저의 최신 입금 정보 로드
    const user = await this.userRepository.readByUserId(meeting.userId);
    if (user) {
      meeting.loadUserDepositInformation(user);
    }

    const managerInfo = {
      member_id: leader.id,
      name: leader.name,
      toss_bank: meeting.tossDepositInformation.getDecryptedBank(),
      account_number: meeting.tossDepositInformation.getDecryptedAccountNumber(),
      bank: meeting.tossDepositInformation.getDecryptedBank(), // 송금 링크 생성용
      kakao_deposit_id: meeting.kakaoDepositInformation.kakaoDepositId,
      kakao_pay_link: meeting.kakaoDepositInformation.kakaoDepositId
        ? `https://qr.kakaopay.com/${meeting.kakaoDepositInformation.kakaoDepositId}`
        : null,
    };

    // Step B. 멤버별 '낸 돈(Credit)' 계산 및 Step C. 최종 송금액 계산
    const finalSettlement = members.map(member => {
      // 멤버별 초기 공금
      const contribution = contributions.find(c => c.memberId === member.id);
      const paidContribution = contribution?.amountKRW || 0;

      // 멤버별 개인 결제액 (선결제: KRW이고 INDIVIDUAL인 결제 중 해당 멤버가 payer_id인 것)
      const memberAdvancePayments = advancePayments.filter(p => p.payerId === member.id);
      const paidIndividual = memberAdvancePayments.reduce((sum, p) => sum + p.price, 0);

      // 총 낸 돈
      const totalPaid = paidContribution + paidIndividual;

      // Step C. 최종 송금액 계산 (Netting)
      const settlementAmount = totalPaid - perPersonCost;

      // 송금 링크 생성
      let tossLink: string | undefined;
      let kakaoLink: string | undefined;
      const absAmount = Math.abs(Math.round(settlementAmount));
      const roundedSettlement = Math.round(settlementAmount);

      if (absAmount > 0 && managerInfo.bank && managerInfo.account_number) {
        // 토스 송금 링크
        const params = new URLSearchParams({
          amount: absAmount.toString(),
          bank: managerInfo.bank,
          accountNo: managerInfo.account_number,
        });
        tossLink = `supertoss://send?${params.toString()}`;
      }

      if (absAmount > 0 && managerInfo.kakao_deposit_id) {
        // 카카오 송금 링크
        const toHexValue = (value: number): string => {
          return (value * 524288).toString(16);
        };
        const hexAmount = toHexValue(absAmount);
        kakaoLink = `https://qr.kakaopay.com/${managerInfo.kakao_deposit_id}${hexAmount}`;
      }

      // 계좌 복사용 텍스트 (은행명 + 계좌번호 + 금액)
      let depositCopyText: string | null = null;
      if (absAmount > 0 && managerInfo.bank && managerInfo.account_number) {
        depositCopyText = `${managerInfo.bank} ${managerInfo.account_number} ${roundedSettlement}원`;
      }

      return {
        member_id: member.id,
        name: member.name,
        paid_contribution: Math.round(paidContribution),
        paid_individual: Math.round(paidIndividual),
        total_paid: Math.round(totalPaid),
        per_person_cost: Math.round(perPersonCost),
        settlement_amount: roundedSettlement,
        direction: settlementAmount > 0 ? 'RECEIVE' : settlementAmount < 0 ? 'SEND' : 'NONE',
        deposit_copy_text: depositCopyText,
        links: {
          toss: tossLink,
          kakao: kakaoLink,
        },
      };
    });

    return {
      public_budget: {
        initial_gonggeum: initialGonggeum,
        total_public_spent: Math.round(totalPublicSpent),
        remaining_gonggeum_krw: Math.round(remainingGonggeumKRW),
        remaining_gonggeum_foreign: Math.round(remainingGonggeumForeign * 100) / 100,
        status: gonggeumStatus,
      },
      trip_cost: {
        total_public_spent: Math.round(totalPublicSpent),
        total_individual_spent: Math.round(totalIndividualSpent),
        grand_total_cost: Math.round(grandTotalCost),
        per_person_cost: Math.round(perPersonCost),
      },
      manager_info: managerInfo,
      final_settlement: finalSettlement,
    };
  }

  /**
   * 여행 정산 결과 페이지 조회 (UUID 기반, 인증 불필요)
   * 
   * @param uuid - 모임 UUID
   * @returns 정산 결과 객체
   */
  async readTripPage(uuid: string): Promise<any> {
    const meeting = await this.meetingRepository.readByUuid(uuid);
    if (!meeting) {
      throw new SharePageNotMeetingException();
    }

    if (!meeting.isTrip) {
      throw new Error('This meeting is not a trip meeting');
    }

    const members = await this.memberRepository.readListByMeetingId(meeting.id!);
    const allPayments = await this.paymentRepository.readListByMeetingId(meeting.id!);
    const contributions = await this.contributionRepository.readListByMeetingId(meeting.id!);

    // 공금으로 결제한 Payment (type === 'PUBLIC' 또는 payer_id === null 또는 0)
    const publicPayments = allPayments.filter(p => 
      (p as any).type === 'PUBLIC' || p.payerId === null || p.payerId === 0
    );

    // 선결제(Advance Payment): currency === 'KRW'이고 type === 'INDIVIDUAL'인 결제
    // type이 없으면 payerId 유무로 판단하는 레거시 로직 포함
    const advancePayments = allPayments.filter(p => {
      const paymentType = (p as any).type || (p.payerId === null || p.payerId === 0 ? 'PUBLIC' : 'INDIVIDUAL');
      return paymentType === 'INDIVIDUAL' && p.currency === 'KRW';
    });

    // 개인 카드 결제: payerId가 있고 0이 아니며, type이 'PUBLIC'이 아닌 모든 결제
    // KRW 제외 조건 추가: 통화가 KRW가 아닌 경우(외화)만 포함
    const individualPayments = allPayments.filter(p => {
      const paymentType = (p as any).type || (p.payerId === null || p.payerId === 0 ? 'PUBLIC' : 'INDIVIDUAL');
      // payerId가 있고, INDIVIDUAL이며, **통화가 KRW가 아닌 경우(외화)**만 포함
      return paymentType === 'INDIVIDUAL' && p.payerId !== null && p.payerId !== 0 && p.currency !== 'KRW';
    });

    // 공금 현황 계산 (Supabase 기준으로 단순화)
    const initialGonggeum = meeting.initialGonggeum || 0;
    const baseExchangeRate = meeting.baseExchangeRate || 1.0;
    const targetCurrency = meeting.targetCurrency || 'KRW';
    const addedGonggeumForeign = (meeting as any).added_foreign || 0;

    // Contribution 합계로 총 모은 공금 계산 (처음 + 추가)
    const totalCollected = contributions.reduce((sum: number, c: any) => sum + (c.amountKRW || 0), 0);

    // 정산 시점 환율 적용 및 미환전 원화 계산
    let finalRemainingKRW = 0;
    let appliedExchangeRate: number | null = null;
    let exchangeRateDate: string | null = null;
    let currentMarketRate = 1.0;
    let usedDate = new Date().toISOString().split('T')[0];
    let totalPublicSpentForeign = 0;
    let remainingForeign = 0;

    if (targetCurrency === 'KRW') {
      appliedExchangeRate = 1.0;
      exchangeRateDate = new Date().toISOString().split('T')[0] || null;
      const totalPublicSpent = publicPayments.reduce((sum: number, p: any) => sum + (p.price || 0), 0);
      finalRemainingKRW = totalCollected - totalPublicSpent;
      totalPublicSpentForeign = 0; // KRW는 외화가 아니므로 0
      remainingForeign = 0; // KRW는 외화가 아니므로 0
    } else {
      // 현재 시장 환율 조회 (최신 환율 사용)
      const today = new Date();
      try {
        currentMarketRate = await this.currencyService.getRate(targetCurrency, today);
        usedDate = today.toISOString().split('T')[0];
      } catch (e) {
        // 환율 조회 실패 시 baseExchangeRate 사용
        currentMarketRate = baseExchangeRate;
        usedDate = new Date().toISOString().split('T')[0];
      }

      // 정산 시점에는 항상 최신 환율 사용
      appliedExchangeRate = currentMarketRate;
      exchangeRateDate = usedDate;

      // 공금 사용액 계산 (외화 기준) - original_price 직접 사용
      totalPublicSpentForeign = publicPayments.reduce((sum: number, p: any) => {
        if (p.originalPrice && p.currency !== 'KRW') {
          return sum + p.originalPrice;
        } else if (p.price && p.exchangeRate && p.exchangeRate > 0) {
          // original_price가 없으면 payment.exchange_rate로 역산
          const estimatedOriginalPrice = p.price / p.exchangeRate;
          return sum + estimatedOriginalPrice;
        } else if (p.price && p.currency === 'KRW') {
          // KRW 결제는 외화로 변환하지 않음
          return sum;
        }
        return sum;
      }, 0);

      // 총 외화 공금 계산
      const initialGonggeumForeign = targetCurrency === 'KRW' 
        ? initialGonggeum
        : (initialGonggeum > 0 ? initialGonggeum / baseExchangeRate : 0);
      const totalForeign = initialGonggeumForeign + addedGonggeumForeign;
      remainingForeign = totalForeign - totalPublicSpentForeign;
      const unexchangedKRW = 0; // 모은 공금을 다 환전한다는 과정이 없으므로 0
      
      // 남은 공금이 있을 때는 최신 환율로 재평가
      const foreignValue = remainingForeign > 0
        ? remainingForeign * currentMarketRate
        : remainingForeign * currentMarketRate;

      finalRemainingKRW = unexchangedKRW + foreignValue;
    }

    // 시장 환율 기준으로 공금 사용액 재계산
    const totalPublicSpent = targetCurrency === 'KRW' 
      ? publicPayments.reduce((sum: number, p: any) => sum + (p.price || 0), 0)
      : Math.round(totalPublicSpentForeign * (appliedExchangeRate || currentMarketRate));
    
    // 실제 총 잔액 계산: total_collected - total_public_spent (원화 기준)
    const realTotalRemainingKRW = totalCollected - totalPublicSpent;

    // 4. 전체 통계용 (수정됨)
    const totalAdvanceSpent = advancePayments.reduce((sum, p) => sum + p.price, 0);
    const totalIndividualCardSpent = individualPayments.reduce((sum, p) => sum + p.price, 0);
    const totalIndividualSpent = totalAdvanceSpent + totalIndividualCardSpent;

    // [Fix] 총 비용 계산: (공금 외화 사용분 * 현재 환율) + 개인 지출
    // 남은 돈을 빼는 방식(역산)은 외화 자산 평가 문제로 부정확하므로 폐기.
    const publicSpentKRW = Math.round(totalPublicSpentForeign * (appliedExchangeRate || 1.0));
    
    const grandTotalCost = publicSpentKRW + totalIndividualSpent;

    const gonggeumStatus: 'SURPLUS' | 'DEFICIT' = finalRemainingKRW >= 0 ? 'SURPLUS' : 'DEFICIT';

    // C. 멤버별 정산 (쓴 돈 직접 계산)
    // perPersonCost (N/1) 변수 삭제
    // 대신 memberDebitMap을 만들어, 각 지출을 참여 인원 수(payment.attendMemberIds.length)로 나누어 각 멤버에게 누적
    const memberDebitMap = new Map<number, number>(); // memberId -> 쓴 돈 (원화)

    // 모든 결제 내역을 순회하며 참여 인원 수로 나누어 각 멤버에게 누적
    // 1. 공금 결제 (publicPayments)
    publicPayments.forEach((payment: any) => {
      const paymentPrice = payment.price || 0;
      const attendMemberIds = payment.attendMemberIds || [];
      const attendCount = attendMemberIds.length;
      
      if (attendCount > 0 && paymentPrice > 0) {
        const perPersonAmount = paymentPrice / attendCount;
        attendMemberIds.forEach((memberId: number) => {
          const currentDebit = memberDebitMap.get(memberId) || 0;
          memberDebitMap.set(memberId, currentDebit + perPersonAmount);
        });
      }
    });

    // 2. 선결제 (advancePayments)
    advancePayments.forEach((payment: any) => {
      const paymentPrice = payment.price || 0;
      const attendMemberIds = payment.attendMemberIds || [];
      const attendCount = attendMemberIds.length;
      
      if (attendCount > 0 && paymentPrice > 0) {
        const perPersonAmount = paymentPrice / attendCount;
        attendMemberIds.forEach((memberId: number) => {
          const currentDebit = memberDebitMap.get(memberId) || 0;
          memberDebitMap.set(memberId, currentDebit + perPersonAmount);
        });
      }
    });

    // 3. 개인 카드 결제 (individualPayments)
    individualPayments.forEach((payment: any) => {
      const paymentPrice = payment.price || 0;
      const attendMemberIds = payment.attendMemberIds || [];
      const attendCount = attendMemberIds.length;
      
      if (attendCount > 0 && paymentPrice > 0) {
        const perPersonAmount = paymentPrice / attendCount;
        attendMemberIds.forEach((memberId: number) => {
          const currentDebit = memberDebitMap.get(memberId) || 0;
          memberDebitMap.set(memberId, currentDebit + perPersonAmount);
        });
      }
    });

    // B. 최종 송금 정보
    // 총무(리더) 정보
    const leader = members.find(m => m.leader);
    if (!leader) {
      throw new Error('Leader not found');
    }

    // 유저의 최신 입금 정보 로드
    const user = await this.userRepository.readByUserId(meeting.userId);
    if (user) {
      meeting.loadUserDepositInformation(user);
    }

    const decryptedBank = meeting.tossDepositInformation.getDecryptedBank();
    const decryptedAccountNumber = meeting.tossDepositInformation.getDecryptedAccountNumber();
    const kakaoDepositId = meeting.kakaoDepositInformation.kakaoDepositId;

    const managerInfo = {
      member_id: leader.id,
      name: leader.name,
      // 프론트 노출용 필드
      toss_bank: decryptedBank,
      account_number: decryptedAccountNumber,
      kakao_pay_link: kakaoDepositId
        ? `https://qr.kakaopay.com/${kakaoDepositId}`
        : null,
      // 내부 송금 링크 계산용 필드
      bank: decryptedBank,
      kakao_deposit_id: kakaoDepositId,
    };

    // Step B & C. 멤버별 최종 정산액 계산
    const finalSettlement = members.map(member => {
      if (!member.id) {
        throw new Error('Member ID is required');
      }

      // 멤버별 초기 공금
      const contribution = contributions.find(c => c.memberId === member.id);
      const paidContribution = contribution?.amountKRW || 0;

      // 멤버별 개인 결제액: 선결제(KRW) + 개인 카드 결제(외화/원화 모두)
      const memberAdvancePayments = advancePayments.filter(p => p.payerId === member.id);
      const memberIndividualPayments = individualPayments.filter(p => p.payerId === member.id);
      const paidAdvance = memberAdvancePayments.reduce((sum, p) => sum + p.price, 0);
      const paidIndividualCard = memberIndividualPayments.reduce((sum, p) => sum + p.price, 0);
      const paidIndividual = paidAdvance + paidIndividualCard;

      // 총 낸 돈
      const totalPaid = paidContribution + paidIndividual;

      // Step C. 최종 송금액 계산 (Netting)
      // memberDebitMap에서 해당 멤버가 쓴 돈을 가져옴
      const memberDebit = memberDebitMap.get(member.id) || 0;
      const settlementAmount = totalPaid - memberDebit;

      // 10원 단위 올림(CEIL) 정산 금액 계산 (1원 단위가 있을 때만)
      const roundedSettlement = Math.round(settlementAmount);
      const tippedSettlement = (() => {
        if (roundedSettlement === 0) return 0;
        // 이미 일의 자리가 0이면 그대로 사용
        if (Math.abs(roundedSettlement) % 10 === 0) return roundedSettlement;
        // 일의 자리가 0이 아닐 때만 10원 단위 올림
        return roundedSettlement > 0
          ? Math.ceil(roundedSettlement / 10) * 10
          : -Math.ceil(Math.abs(roundedSettlement) / 10) * 10;
      })();

      // 송금 링크 생성
      let tossLink: string | undefined;
      let tippedTossLink: string | undefined;
      let kakaoLink: string | undefined;
      let tippedKakaoLink: string | undefined;

      const absAmount = Math.abs(roundedSettlement);
      const absTippedAmount = Math.abs(tippedSettlement);

      if (absAmount > 0 && managerInfo.bank && managerInfo.account_number) {
        const params = new URLSearchParams({
          amount: absAmount.toString(),
          bank: managerInfo.bank,
          accountNo: managerInfo.account_number,
        });
        tossLink = `supertoss://send?${params.toString()}`;
      }

      if (absTippedAmount > 0 && managerInfo.bank && managerInfo.account_number) {
        const tippedParams = new URLSearchParams({
          amount: absTippedAmount.toString(),
          bank: managerInfo.bank,
          accountNo: managerInfo.account_number,
        });
        tippedTossLink = `supertoss://send?${tippedParams.toString()}`;
      }

      if (absAmount > 0 && managerInfo.kakao_deposit_id) {
        const toHexValue = (value: number): string => {
          return (value * 524288).toString(16);
        };
        const hexAmount = toHexValue(absAmount);
        kakaoLink = `https://qr.kakaopay.com/${managerInfo.kakao_deposit_id}${hexAmount}`;

        const tippedHexAmount = toHexValue(absTippedAmount);
        tippedKakaoLink = `https://qr.kakaopay.com/${managerInfo.kakao_deposit_id}${tippedHexAmount}`;
      }

      let depositCopyText: string | null = null;
      let tippedDepositCopyText: string | null = null;
      if (absAmount > 0 && managerInfo.bank && managerInfo.account_number) {
        depositCopyText = `${managerInfo.bank} ${managerInfo.account_number} ${roundedSettlement}원`;
        tippedDepositCopyText = `${managerInfo.bank} ${managerInfo.account_number} ${tippedSettlement}원`;
      }

      return {
        member_id: member.id,
        name: member.name,
        paid_contribution: Math.round(paidContribution),
        paid_individual: Math.round(paidIndividual),
        total_paid: Math.round(totalPaid),
        total_debit: Math.round(memberDebit),
        settlement_amount: roundedSettlement,
        settlement_tipped_amount: tippedSettlement,
        direction: settlementAmount > 0 ? 'RECEIVE' : settlementAmount < 0 ? 'SEND' : 'NONE',
        deposit_copy_text: depositCopyText,
        tipped_deposit_copy_text: tippedDepositCopyText,
        links: {
          toss_deposit_link: tossLink,
          tipped_toss_deposit_link: tippedTossLink,
          kakao_deposit_link: kakaoLink,
          tipped_kakao_deposit_link: tippedKakaoLink,
        },
      };
    });

    return {
      meeting: meeting.toJSON(),
      public_budget: {
        initial_gonggeum: initialGonggeum, // 초기 공금
        added_gonggeum: Math.round(addedGonggeumForeign * 100) / 100, // 추가된 공금 (외화 기준)
        total_collected: totalCollected, // 총 모은 공금
        total_public_spent: Math.round(totalPublicSpent), // 총 지출 (원화 환산)
        real_total_remaining_krw: Math.round(realTotalRemainingKRW), // 실제 총 잔액 (total_collected - spent)
        remaining_gonggeum_krw: Math.round(finalRemainingKRW), // 외화 잔액의 원화 가치
        remaining_gonggeum_foreign: Math.round(remainingForeign * 100) / 100, // 외화 잔액
        status: gonggeumStatus,
        applied_exchange_rate: appliedExchangeRate || currentMarketRate, // 현재 환율
        exchange_rate_date: exchangeRateDate, // 환율 날짜
        target_currency: targetCurrency, // 통화 코드
      },
      trip_cost: {
        total_public_spent: Math.round(totalPublicSpent),
        total_individual_spent: Math.round(totalIndividualSpent),
        grand_total_cost: Math.round(grandTotalCost),
      },
      manager_info: managerInfo,
      final_settlement: finalSettlement,
    };
  }

  /**
   * 공유 페이지 조회 (UUID 기반, 인증 불필요)
   * GET /meeting/share/:uuid
   * 
   * @param uuid - 모임 UUID
   * @returns 공유 페이지 데이터
   */
  async readSharePageByUuid(uuid: string): Promise<any> {
    const tripData = await this.meetingRepository.findTripByUuid(uuid);
    if (!tripData) {
      throw new SharePageNotMeetingException();
    }

    const { meeting: meetingModel, members, contributions, payments: allPayments } = tripData;

    if (!meetingModel.isTrip) {
      throw new Error('This meeting is not a trip meeting');
    }

    const meetingId = meetingModel.id;

    // 공금으로 결제한 Payment (type === 'PUBLIC' 또는 payer_id === null)
    const publicPayments = allPayments.filter((p: any) => 
      p.type === 'PUBLIC' || p.payerId === null
    );

    // 선결제(Advance Payment): currency === 'KRW'이고 type === 'INDIVIDUAL'인 결제
    const advancePayments = allPayments.filter((p: any) => {
      const paymentType = p.type || (p.payerId === null ? 'PUBLIC' : 'INDIVIDUAL');
      return paymentType === 'INDIVIDUAL' && p.currency === 'KRW';
    });

    // Step A. 전체 비용 계산
    const totalPublicSpent = publicPayments.reduce((sum: number, p: any) => sum + p.price, 0);
    const totalIndividualSpent = advancePayments.reduce((sum: number, p: any) => sum + p.price, 0);
    const grandTotalCost = totalPublicSpent + totalIndividualSpent;
    const memberCount = members.length;
    const perPersonCost = memberCount > 0 ? grandTotalCost / memberCount : 0;

    // 공금 현황 계산 (선결제는 공금 잔액에서 차감하지 않음)
    const initialGonggeum = meetingModel.initialGonggeum || 0;
    const remainingGonggeumKRW = initialGonggeum - totalPublicSpent;
    const remainingGonggeumForeign = remainingGonggeumKRW * (meetingModel.baseExchangeRate || 1.0);

    // Step B & C. 멤버별 실시간 잔액 계산 (선결제 포함 통합 정산)
    const membersStatus = members.map((member: any) => {
      // MyContribution: 내가 낸 초기 공금
      const contribution = contributions.find((c: any) => c.memberId === member.id);
      const myContribution = contribution?.amountKRW || 0;

      // MyAdvancePayment: 내가 결제한 선결제 항목 합계
      const memberAdvancePayments = advancePayments.filter((p: any) => p.payerId === member.id);
      const myAdvancePayment = memberAdvancePayments.reduce((sum: number, p: any) => sum + p.price, 0);

      // MyTotalCredit: 내가 낸 총 돈
      const myTotalCredit = myContribution + myAdvancePayment;

      // current_balance: 실시간 잔액
      const currentBalance = myTotalCredit - perPersonCost;

      // 송금 링크 생성 (balance가 음수인 경우만)
      let remittance: any = null;
      if (currentBalance < 0) {
        const sendAmount = Math.abs(Math.round(currentBalance));
        
        // 총무(리더) 정보 가져오기
        const leader = members.find((m: any) => m.leader);
        let managerBank: string | null = null;
        let managerAccount: string | null = null;
        let managerKakaoId: string | null = null;

        if (leader && meetingModel.accountNumber && meetingModel.bank) {
          try {
            const bankBuffer = Buffer.isBuffer(meetingModel.bank) 
              ? meetingModel.bank 
              : Buffer.from(meetingModel.bank);
            const accountBuffer = Buffer.isBuffer(meetingModel.accountNumber)
              ? meetingModel.accountNumber
              : Buffer.from(meetingModel.accountNumber);

            managerBank = aesDecrypt(bankBuffer);
            managerAccount = aesDecrypt(accountBuffer);
          } catch (error) {
          }
        }

        if (meetingModel.kakaoDepositId) {
          managerKakaoId = meetingModel.kakaoDepositId;
        }

        // Toss 링크 생성
        let tossLink: string | null = null;
        if (managerBank && managerAccount) {
          const params = new URLSearchParams({
            amount: sendAmount.toString(),
            bank: managerBank,
            accountNo: managerAccount,
          });
          tossLink = `supertoss://send?${params.toString()}`;
        }

        // Kakao 링크 생성
        let kakaoLink: string | null = null;
        if (managerKakaoId) {
          const hexAmount = (sendAmount * 524288).toString(16);
          kakaoLink = `https://qr.kakaopay.com/${managerKakaoId}${hexAmount}`;
        }

        remittance = {
          amount: sendAmount,
          toss: tossLink,
          kakao: kakaoLink,
        };
      }

      return {
        name: member.name,
        paid_contribution: Math.round(myContribution),
        paid_advance: Math.round(myAdvancePayment),
        total_credit: Math.round(myTotalCredit),
        current_balance: Math.round(currentBalance),
        per_person_cost: Math.round(perPersonCost),
        direction: currentBalance > 0 ? 'RECEIVE' : currentBalance < 0 ? 'SEND' : 'NONE',
        remittance: remittance,
      };
    });

    // 결제 내역 리스트 (최신순)
    const paymentList = allPayments
      .sort((a, b) => {
        // orderNo가 있으면 orderNo 기준, 없으면 id 기준 (최신순)
        if (a.id && b.id) {
          return b.id - a.id;
        }
        return 0;
      })
      .slice(0, 20) // 최근 20개만
      .map(payment => {
        const paymentType = (payment).type || (payment.payerId === null ? 'PUBLIC' : 'INDIVIDUAL');
        return {
          id: payment.id,
          name: payment.name || payment.place,
          place: payment.place,
          price: payment.price,
          original_price: payment.originalPrice,
          currency: payment.currency,
          exchange_rate: payment.exchangeRate,
          type: paymentType,
          is_advance_payment: paymentType === 'INDIVIDUAL' && payment.currency === 'KRW',
          pay_member_id: payment.payMemberId,
          attend_member_ids: payment.attendMemberIds,
          created_at: (payment).createdAt,
        };
      });

    return {
      meeting: {
        id: meetingId,
        name: meetingModel.name,
        date: meetingModel.date,
        country_code: meetingModel.countryCode,
        target_currency: meetingModel.targetCurrency,
        base_exchange_rate: meetingModel.baseExchangeRate,
      },
      public_budget: {
        initial_gonggeum: initialGonggeum,
        total_public_spent: Math.round(totalPublicSpent),
        remaining_gonggeum_krw: Math.round(remainingGonggeumKRW),
        remaining_gonggeum_foreign: Math.round(remainingGonggeumForeign * 100) / 100,
      },
      trip_cost: {
        total_public_spent: Math.round(totalPublicSpent),
        total_individual_spent: Math.round(totalIndividualSpent),
        grand_total_cost: Math.round(grandTotalCost),
        per_person_cost: Math.round(perPersonCost),
      },
      members_status: membersStatus,
      payment_list: paymentList,
    };
  }

  /**
   * 해외여행 실시간 대시보드 조회 (공금 모니터링 중심)
   * GET /meeting/share/trip?uuid={uuid} 또는 GET /meeting/:id/dashboard
   * 
   * 여행 도중에는 복잡한 개인 간 정산보다 공금 잔액 확인이 최우선
   * attendMemberIds에 따라 개인 지분 추적
   * 실시간 환율로 부족분 계산
   * 
   * @param uuid - 모임 UUID (또는 meetingId)
   * @param userId - 선택적: 로그인한 사용자 ID (나의 공금 지분 표시용)
   * @param useMeetingId - true면 uuid를 meetingId로 해석
   * @returns 대시보드 데이터
   */
  async getTripDashboard(uuid: string, userId?: number, useMeetingId: boolean = false, limit: number = 10, offset: number = 0): Promise<any> {
    let tripData;
    
    if (useMeetingId) {
      const meetingId = parseInt(uuid, 10);
      if (isNaN(meetingId)) {
        throw new Error('Invalid meeting ID');
      }
      const meeting = await this.meetingRepository.readById(meetingId);
      if (!meeting || !meeting.isTrip) {
        throw new Error('Trip meeting not found');
      }
      const members = await this.memberRepository.readListByMeetingId(meetingId);
      const contributions = await this.contributionRepository.readListByMeetingId(meetingId);
      const payments = await this.paymentRepository.readListByMeetingId(meetingId);
      tripData = {
        meeting: meeting,
        members: members,
        contributions: contributions,
        payments: payments,
      };
    } else {
      tripData = await this.meetingRepository.findTripByUuid(uuid);
      if (!tripData) {
        throw new SharePageNotMeetingException();
      }
    }

    const { meeting: meetingModel, members, contributions, payments } = tripData;

    if (!meetingModel.isTrip) {
      throw new Error('This meeting is not a trip meeting');
    }

    // 공금으로 결제한 Payment만 필터링 (돈의 출처만 확인: payerId === null 또는 0)
    // type 조건 제거: 공금으로 개인 물건을 산 경우도 포함해야 함
    const publicPayments = payments.filter((p: any) => 
      p.payerId === null || p.payerId === 0
    );

    const baseExchangeRate = meetingModel.baseExchangeRate || 1.0;
    const initialGonggeum = meetingModel.initialGonggeum || 0;
    const memberCount = members.length;
    const targetCurrency = meetingModel.targetCurrency || 'KRW';

    // 공금 수집액 계산 (원화 기준)
    const totalKRW = contributions.reduce((sum: number, c: any) => sum + c.amountKRW, 0);
    // [Fix] 공금 추가 시 총액 증가 반영: 초기값과 실제 누적액 중 큰 값을 사용
    // (공금을 추가했다면 totalKRW가 initialGonggeum보다 커질 수 있음)
    const totalCollected = Math.max(initialGonggeum, totalKRW);

    // 총 외화 공금 (TotalForeign)
    const totalForeign = totalCollected / baseExchangeRate;

    // 공금 사용액 계산 (외화 기준)
    // 공금 결제의 originalPrice를 사용하거나, price를 baseExchangeRate로 나눔
    const totalSpentForeign = publicPayments.reduce((sum: number, p: any) => {
      if (p.originalPrice && p.currency !== 'KRW') {
        // 외화 금액이 있으면 그대로 사용
        return sum + p.originalPrice;
      } else if (p.price) {
        // 원화 금액을 외화로 변환
        return sum + (p.price / baseExchangeRate);
      }
      return sum;
    }, 0);

    // 공금 잔액 (외화 기준)
    const remainingForeign = totalForeign - totalSpentForeign;

    // 사용률 계산 (burn_rate: 0~100%)
    const burnRate = totalForeign > 0 
      ? Math.round((totalSpentForeign / totalForeign) * 1000) / 10  // 소수점 1자리
      : 0;

    // 상태 판단: 80% 이상 사용 시 DANGER, 60% 이상 사용 시 WARNING, 그 외 SAFE
    let status: 'SAFE' | 'WARNING' | 'DANGER';
    if (burnRate >= 80) {
      status = 'DANGER';
    } else if (burnRate >= 60) {
      status = 'WARNING';
    } else {
      status = 'SAFE';
    }

    // 개인별 공금 지분 추적 (외화 기준)
    // 1인당 초기 지분 계산
    const initialSharePerPerson = memberCount > 0 ? totalForeign / memberCount : 0;

    // 각 멤버의 공금 사용액 추적 (외화 기준) - 정밀 계산
    // 공금 지출 내역을 하나씩 순회하며 attendMemberIds에 따라 정확히 차감
    const memberSpentMap = new Map<number, number>(); // memberId -> spent (외화)
    
    publicPayments.forEach((payment: any) => {
      // 해당 결제의 외화 금액
      let paymentForeign: number;
      if (payment.originalPrice && payment.currency !== 'KRW') {
        paymentForeign = payment.originalPrice;
      } else if (payment.price) {
        paymentForeign = payment.price / baseExchangeRate;
      } else {
        return; // 금액이 없으면 스킵
      }

      // attendMemberIds에 따라 정밀 분배
      const attendCount = payment.attendMemberIds?.length || 0;
      if (attendCount > 0) {
        // UnitCost = originalPrice / attendMembers.length
        const unitCost = paymentForeign / attendCount;
        
        // attendMembers에 포함된 각 멤버의 used_amount에 UnitCost를 더함
        payment.attendMemberIds.forEach((memberId: number) => {
          const currentSpent = memberSpentMap.get(memberId) || 0;
          memberSpentMap.set(memberId, currentSpent + unitCost);
        });
      }
    });

    // Step B & C. 모든 멤버의 공금 지분 상태 계산 (members_wallet_status) - 정밀 추적
    // InitialShare = TotalForeign / MemberCount
    const initialShare = initialSharePerPerson;
    
    // userId로 멤버 찾기 (is_me 필드용)
    let myMemberId: number | null = null;
    if (userId !== undefined) {
      const myMember = members.find((m: any) => {
        return m.userId && parseInt(m.userId, 10) === userId;
      });
      if (myMember && myMember.id) {
        myMemberId = myMember.id;
      }
    }
    
    const membersWalletStatus = members.map((member: any) => {
      const memberId = member.id;
      if (!memberId) return null;

      // UsedAmount = memberSpentMap.get(id) (정밀 계산된 값)
      const usedAmount = memberSpentMap.get(memberId) || 0;
      
      // CurrentShare = InitialShare - UsedAmount
      const currentShare = initialShare - usedAmount;
      
      // Ratio = (CurrentShare / InitialShare) * 100 (남은 지분 비율)
      const ratio = initialShare > 0 
        ? Math.round((currentShare / initialShare) * 1000) / 10
        : 0;
      
      // Status 결정: ratio >= 50: SAFE, 20 <= ratio < 50: WARNING, ratio < 20: DANGER
      let memberStatus: 'SAFE' | 'WARNING' | 'DANGER';
      if (ratio >= 50) {
        memberStatus = 'SAFE';
      } else if (ratio >= 20) {
        memberStatus = 'WARNING';
      } else {
        memberStatus = 'DANGER';
      }

      return {
        member_id: memberId,
        name: member.name,
        initial_share: Math.round(initialShare * 100) / 100,
        used_amount: Math.round(usedAmount * 100) / 100,
        current_share: Math.round(currentShare * 100) / 100,
        ratio: ratio,
        status: memberStatus,
        is_me: myMemberId !== null && memberId === myMemberId,  // 메인 대시보드이므로 로그인 유저 확인
      };
    }).filter((item: any) => item !== null);

    // 나의 공금 지분 계산 (userId가 제공된 경우만)
    let myPublicStatus: {
      initial_share: number;      // 초기 지분 (외화)
      spent: number;               // 사용한 금액 (외화)
      remaining: number;           // 남은 지분 (외화)
      is_negative: boolean;        // 마이너스 여부
      deficit_krw: number;        // 부족분 (원화, 실시간 환율 적용)
    } | null = null;

    if (userId !== undefined) {
      // userId로 멤버 찾기
      const myMember = members.find((m: any) => {
        return m.userId && parseInt(m.userId, 10) === userId;
      });

      if (myMember && myMember.id) {
        const mySpent = memberSpentMap.get(myMember.id) || 0;
        const myRemaining = initialSharePerPerson - mySpent;
        const isNegative = myRemaining < 0;

        // 부족분 계산 (실시간 환율 적용)
        let deficitKRW = 0;
        if (isNegative && targetCurrency !== 'KRW') {
          try {
            const currentRate = await this.currencyService.getRate(targetCurrency);
            deficitKRW = Math.abs(myRemaining) * currentRate;
          } catch (error) {
            // 실시간 환율 조회 실패 시 초기 환율 사용
            deficitKRW = Math.abs(myRemaining) * baseExchangeRate;
          }
        } else if (isNegative) {
          deficitKRW = Math.abs(myRemaining);
        }

        myPublicStatus = {
          initial_share: Math.round(initialSharePerPerson * 100) / 100,
          spent: Math.round(mySpent * 100) / 100,
          remaining: Math.round(myRemaining * 100) / 100,
          is_negative: isNegative,
          deficit_krw: Math.round(deficitKRW),
        };
      }
    }

    // 최신 결제 내역 (페이지네이션 적용)
    const sortedPayments = payments.sort((a: any, b: any) => {
      // 최신순 정렬 (id 기준 내림차순)
      return (b.id || 0) - (a.id || 0);
    });
    
    const totalPayments = sortedPayments.length;
    const hasMore = offset + limit < totalPayments;
    
    const recentPayments = sortedPayments
      .slice(offset, offset + limit)
      .map((payment: any) => {
        const paymentType = payment.type || (payment.payerId === null ? 'PUBLIC' : 'INDIVIDUAL');
        const isForeignCurrency = payment.currency && payment.currency !== 'KRW';
        
        // 외화 결제: original_price와 currency만 표시 (한화 변환 금액과 환율 제거)
        if (isForeignCurrency) {
          return {
            id: payment.id,
            name: payment.name || payment.place,
            place: payment.place,
            original_price: payment.originalPrice,
            currency: payment.currency,
            type: paymentType,
            is_public: paymentType === 'PUBLIC',
            pay_member_id: payment.payMemberId,
            attend_member_ids: payment.attendMemberIds,
            created_at: payment.createdAt,
          };
        }
        
        // KRW 결제: price만 표시
        return {
          id: payment.id,
          name: payment.name || payment.place,
          place: payment.place,
          price: payment.price,
          currency: payment.currency,
          type: paymentType,
          is_public: paymentType === 'PUBLIC',
          pay_member_id: payment.payMemberId,
          attend_member_ids: payment.attendMemberIds,
          created_at: payment.createdAt,
        };
      });

    return {
      currency: targetCurrency,
      total_public_remaining: Math.round(remainingForeign * 100) / 100,
      my_public_status: myPublicStatus,
      public_wallet: {
        total_collected: Math.round(totalCollected),           // 원화
        total_collected_foreign: Math.round(totalForeign * 100) / 100, // 외화
        total_spent: Math.round(totalSpentForeign * baseExchangeRate), // 원화
        total_spent_foreign: Math.round(totalSpentForeign * 100) / 100, // 외화
        remaining: Math.round(remainingForeign * baseExchangeRate), // 원화
        remaining_foreign: Math.round(remainingForeign * 100) / 100, // 외화
        burn_rate: burnRate,
        status: status,
      },
      members_wallet_status: membersWalletStatus, // 모든 멤버의 공금 지분 상태
      recent_payments: recentPayments,
      pagination: {
        limit: limit,
        offset: offset,
        total: totalPayments,
        has_more: hasMore,
      },
    };
  }

  /**
   * 해외여행 최종 정산 결과 조회
   * GET /meeting/:id/result
   * 
   * 남은 공금은 초기 환율로 환산하여 최종 정산
   * 
   * @param meetingId - 모임 ID
   * @param userId - 사용자 ID
   * @returns 최종 정산 결과
   */
  async getTripResult(meetingId: number, userId: number): Promise<any> {
    const meeting = await this.meetingRepository.readById(meetingId);
    if (!meeting) {
      throw new Error('Meeting not found');
    }
    meeting.isUserOfMeeting(userId);

    if (!meeting.isTrip) {
      throw new Error('This meeting is not a trip meeting');
    }

    const members = await this.memberRepository.readListByMeetingId(meetingId);
    const allPayments = await this.paymentRepository.readListByMeetingId(meetingId);
    const contributions = await this.contributionRepository.readListByMeetingId(meetingId);

    const baseExchangeRate = meeting.baseExchangeRate || 1.0;
    const initialGonggeum = meeting.initialGonggeum || 0;
    const targetCurrency = meeting.targetCurrency || 'KRW';

    // 공금 결제 (payerId === null 또는 0)
    const publicPayments = allPayments.filter((p: any) => 
      p.payerId === null || p.payerId === 0 || p.type === 'PUBLIC'
    );

    // 개인 결제 (payerId !== null)
    // KRW 제외 조건 추가: 통화가 KRW가 아닌 경우(외화)만 포함
    const privatePayments = allPayments.filter((p: any) => 
      p.payerId !== null && p.payerId !== 0 && p.type !== 'PUBLIC' && p.currency !== 'KRW'
    );

    // 선결제 (currency === 'KRW'이고 type === 'INDIVIDUAL')
    const advancePayments = allPayments.filter((p: any) => {
      const paymentType = p.type || (p.payerId === null ? 'PUBLIC' : 'INDIVIDUAL');
      return paymentType === 'INDIVIDUAL' && p.currency === 'KRW';
    });

    // Step 1. 공금 사용액 계산 (외화 기준)
    const totalPublicSpentForeign = publicPayments.reduce((sum: number, p: any) => {
      if (p.originalPrice && p.currency !== 'KRW') {
        return sum + p.originalPrice;
      } else if (p.price) {
        return sum + (p.price / baseExchangeRate);
      }
      return sum;
    }, 0);

    // 총 외화 공금
    const totalForeign = initialGonggeum > 0 
      ? initialGonggeum / baseExchangeRate
      : contributions.reduce((sum: number, c: any) => sum + c.amountKRW, 0) / baseExchangeRate;

    // 남은 공금 (외화)
    const remainingForeign = totalForeign - totalPublicSpentForeign;

    // 정산 시점 환율 적용: 남은 외화가 있으면 오늘의 실시간 환율로 재평가
    let finalRemainingKRW = initialGonggeum - (totalPublicSpentForeign * baseExchangeRate); // 기본값
    let appliedExchangeRate: number | null = null;
    let exchangeRateDate: string | null = null;

    if (remainingForeign > 0 && targetCurrency !== 'KRW') {
      try {
        // 오늘의 실시간 환율 조회
        const today = new Date();
        appliedExchangeRate = await this.currencyService.getRate(targetCurrency, today);
        exchangeRateDate = today.toISOString().split('T')[0] || null;
        
        // 남은 외화를 오늘 환율로 재평가
        finalRemainingKRW = remainingForeign * appliedExchangeRate;
      } catch (error) {
        // 환율 조회 실패 시 초기 환율 사용
        appliedExchangeRate = baseExchangeRate;
        exchangeRateDate = new Date().toISOString().split('T')[0] || null;
        finalRemainingKRW = remainingForeign * baseExchangeRate;
      }
    } else if (targetCurrency === 'KRW') {
      // KRW인 경우 환율 1.0
      appliedExchangeRate = 1.0;
      exchangeRateDate = new Date().toISOString().split('T')[0] || null;
    } else {
      // 남은 외화가 없거나 0인 경우 초기 환율 사용
      appliedExchangeRate = baseExchangeRate;
      exchangeRateDate = new Date().toISOString().split('T')[0] || null;
      finalRemainingKRW = remainingForeign * baseExchangeRate;
    }

    // Step 2. 최종 지출 비용 산출 (원화 기준)
    // TotalSpent = TotalContribution - final_remaining_krw
    const totalContribution = initialGonggeum > 0 
      ? initialGonggeum 
      : contributions.reduce((sum: number, c: any) => sum + c.amountKRW, 0);
    const totalKRWSpent = totalContribution - finalRemainingKRW;

    // Step 3. 개인별 정산 계산
    const membersBalance = members.map((member: any) => {
      // Credit (낸 돈)
      const contribution = contributions.find((c: any) => c.memberId === member.id);
      const initialContribution = contribution?.amountKRW || 0;

      // 선결제 합계 (currency === 'KRW'이고 type === 'INDIVIDUAL')
      const myAdvancePayments = advancePayments.filter((p: any) => p.payerId === member.id);
      const advancePaymentsSum = myAdvancePayments.reduce((sum: number, p: any) => sum + p.price, 0);

      // 개인 카드로 결제한 공통 지출 (payerId === member.id이고 attendMemberIds.length > 1)
      const myCardPayments = privatePayments.filter((p: any) => {
        return p.payerId === member.id && 
               p.attendMemberIds && 
               p.attendMemberIds.length > 1; // 공통 지출만 (개인 지출 제외)
      });
      const cardPaymentsSum = myCardPayments.reduce((sum: number, p: any) => sum + p.price, 0);

      const totalCredit = initialContribution + advancePaymentsSum + cardPaymentsSum;

      // Debit (쓴 돈)
      // 1. 공금 지갑 -> 공통 지출 (attendMemberIds.length > 1): Amount / N
      // 2. 공금 지갑 -> 개인 지출 (attendMemberIds.length === 1): Amount 전액
      let publicConsumption = 0;
      publicPayments.forEach((payment: any) => {
        if (payment.attendMemberIds?.includes(member.id)) {
          let paymentKRW: number;
          if (payment.originalPrice && payment.currency !== 'KRW') {
            // 외화를 원화로 환산 (초기 환율 적용)
            paymentKRW = payment.originalPrice * baseExchangeRate;
          } else if (payment.price) {
            paymentKRW = payment.price;
          } else {
            return;
          }

          const attendCount = payment.attendMemberIds.length;
          if (attendCount === 1) {
            // 개인 지출: 전액 부담
            publicConsumption += paymentKRW;
          } else if (attendCount > 1) {
            // 공통 지출: 균등 분배
            publicConsumption += paymentKRW / attendCount;
          }
        }
      });

      // 3. 개인 카드 -> 공통 지출: Amount / N
      let privateConsumption = 0;
      privatePayments.forEach((payment: any) => {
        if (payment.attendMemberIds?.includes(member.id)) {
          const attendCount = payment.attendMemberIds.length;
          if (attendCount > 0) {
            // 개인 카드로 결제한 공통 지출은 균등 분배
            privateConsumption += payment.price / attendCount;
          }
        }
      });

      const totalDebit = publicConsumption + privateConsumption;

      // Final Balance
      const finalBalance = totalCredit - totalDebit;

      return {
        member_id: member.id,
        name: member.name,
        credit: {
          initial_contribution: Math.round(initialContribution),
          advance_payments: Math.round(advancePaymentsSum),
          card_payments: Math.round(cardPaymentsSum), // 개인 카드로 결제한 공통 지출
          total: Math.round(totalCredit),
        },
        debit: {
          public_consumption: Math.round(publicConsumption), // 공금 지갑 사용 (공통 + 개인)
          private_consumption: Math.round(privateConsumption), // 개인 카드 공통 지출 분담
          total: Math.round(totalDebit),
        },
        final_balance: Math.round(finalBalance),
        direction: finalBalance > 0 ? 'RECEIVE' : finalBalance < 0 ? 'SEND' : 'NONE',
      };
    });

    return {
      meeting: {
        id: meeting.id,
        name: meeting.name,
        currency: targetCurrency,
        base_exchange_rate: baseExchangeRate,
      },
      public_fund: {
        total_foreign: Math.round(totalForeign * 100) / 100,
        total_spent_foreign: Math.round(totalPublicSpentForeign * 100) / 100,
        remaining_foreign: Math.round(remainingForeign * 100) / 100,
        remaining_krw_value: Math.round(finalRemainingKRW), // 오늘 환율로 재평가된 값
        applied_exchange_rate: appliedExchangeRate,
        exchange_rate_date: exchangeRateDate,
      },
      settlement: {
        total_krw_spent: Math.round(totalKRWSpent),
        members_balance: membersBalance,
      },
    };
  }
}

