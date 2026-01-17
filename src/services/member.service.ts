import { Member } from '../domains/member.domain';
import { MeetingRepository } from '../repositories/meeting.repository';
import { MemberRepository } from '../repositories/member.repository';
import { PaymentRepository } from '../repositories/payment.repository';
import { ContributionRepository } from '../repositories/contribution.repository';
import { Calculate } from '../domains/calculate.domain';
import { LeaderAlreadyException } from '../exceptions/custom.exceptions';
import { MemberDTO, setDTO } from '../dto/member.dto';

/**
 * Member Service
 * Python의 member/service.py와 동일한 로직
 */
export class MemberService {
  private meetingRepository: MeetingRepository;
  private memberRepository: MemberRepository;
  private paymentRepository: PaymentRepository;
  private contributionRepository: ContributionRepository;

  constructor() {
    this.meetingRepository = new MeetingRepository();
    this.memberRepository = new MemberRepository();
    this.paymentRepository = new PaymentRepository();
    this.contributionRepository = new ContributionRepository();
  }

  /**
   * Python: def create(self, name, leader, meeting_id, user_id)
   */
  async create(name: string, leader: boolean, meetingId: number, userId: number): Promise<Member> {
    const meeting = await this.meetingRepository.readById(meetingId);
    if (!meeting) {
      throw new Error('Meeting not found');
    }
    meeting.isUserOfMeeting(userId);
    const member = new Member(null, name, leader, meetingId);
    if (member.leader) {
      const existingMembers = await this.memberRepository.readListByMeetingId(member.meetingId);
      if (existingMembers.length > 0) {
        throw new LeaderAlreadyException();
      }
    }
    await this.memberRepository.create(member);
    return member;
  }

  /**
   * Python: def update(self, id, name, leader, meeting_id, user_id)
   */
  async update(id: number, name: string, leader: boolean, meetingId: number, userId: number): Promise<void> {
    const meeting = await this.meetingRepository.readById(meetingId);
    if (!meeting) {
      throw new Error('Meeting not found');
    }
    meeting.isUserOfMeeting(userId);
    const member = new Member(id, name, leader, meetingId);
    if (member.leader) {
      const preLeaderMember = await this.memberRepository.readLeaderMemberByMeetingId(member.meetingId);
      if (preLeaderMember) {
        preLeaderMember.leader = false;
        await this.memberRepository.update(preLeaderMember);
      }
    }
    await this.memberRepository.update(member);
  }

  /**
   * Python: def delete(self, member_id, meeting_id, user_id)
   */
  async delete(memberId: number, meetingId: number, userId: number): Promise<void> {
    const meeting = await this.meetingRepository.readById(meetingId);
    if (!meeting) {
      throw new Error('Meeting not found');
    }
    meeting.isUserOfMeeting(userId);
    const member = await this.memberRepository.readById(memberId);
    if (!member) {
      throw new Error('Member not found');
    }
    member.deleteMemberIfNotLeader();
    const payments = await this.paymentRepository.readListByMeetingId(meetingId);
    for (const payment of payments) {
      payment.checkInMember(member);
    }
    await this.memberRepository.delete(member);
  }

  /**
   * Python: def read(self, meeting_id, user_id)
   */
  async read(meetingId: number, userId: number): Promise<MemberDTO[]> {
    const meeting = await this.meetingRepository.readById(meetingId);
    if (!meeting) {
      throw new Error('Meeting not found');
    }
    meeting.isUserOfMeeting(userId);
    const members = await this.memberRepository.readListByMeetingId(meetingId);
    const payments = await this.paymentRepository.readListByMeetingId(meetingId);
    
    // Trip 모드인 경우 Contribution 조회 및 반영
    if (meeting.isTrip) {
      const contributions = await this.contributionRepository.readListByMeetingId(meetingId);
      // console.log('Trip mode - contributions:', contributions);
      const contributionMap = new Map<number, number>();
      contributions.forEach(c => {
        contributionMap.set(c.memberId, c.amountKRW);
      });
      
      // 각 멤버의 초기 기여금을 amount에 설정
      members.forEach(member => {
        if (member.id) {
          const contribution = contributionMap.get(member.id);
          // console.log(`Member ${member.id} (${member.name}): contribution = ${contribution}`);
          if (contribution !== undefined) {
            member.amount = contribution;
            // console.log(`Set member ${member.id} amount to ${member.amount}`);
          }
        }
      });
    }
    
    // setDTO 호출 전에 member.amount 확인
    // console.log('Before setDTO - members amount:', members.map(m => ({ id: m.id, name: m.name, amount: m.amount })));
    
    if (!payments || payments.length === 0) {
      const result = setDTO(MemberDTO, members) as MemberDTO[];
      // console.log('After setDTO (no payments) - result amount:', result.map(m => ({ id: m.id, name: m.name, amount: m.amount })));
      return result;
    }

    // Trip 모드인 경우: 공금 결제도 멤버 수로 나눠서 각 멤버의 부담으로 계산
    // 공금 결제: 전체 금액을 멤버 수로 나눠서 각 멤버의 amount에서 차감
    // 개인 결제: 기존 Calculate 로직 사용
    if (meeting.isTrip) {
      // 공금 결제 처리: 전체 금액을 멤버 수로 나눠서 각 멤버의 amount에서 차감
      const publicPayments = payments.filter(p => {
        const paymentType = (p as any).type || (p.payerId === null ? 'PUBLIC' : 'INDIVIDUAL');
        return paymentType === 'PUBLIC';
      });
      
      if (publicPayments.length > 0 && members.length > 0) {
        publicPayments.forEach(payment => {
          const perPersonAmount = payment.price / members.length;
          // 모든 멤버의 amount에서 차감 (공금으로 결제했으므로 모두 부담)
          members.forEach(member => {
            member.amount -= perPersonAmount;
          });
        });
        // console.log('After public payments split (trip mode) - members amount:', members.map(m => ({ id: m.id, name: m.name, amount: m.amount })));
      }
      
      // 개인 결제 처리: 기존 Calculate 로직 사용
      const individualPayments = payments.filter(p => {
        const paymentType = (p as any).type || (p.payerId === null ? 'PUBLIC' : 'INDIVIDUAL');
        return paymentType === 'INDIVIDUAL';
      });
      
      if (individualPayments.length > 0) {
        const calculate = new Calculate(members, individualPayments);
        calculate.splitMembers();
        // console.log('After splitMembers (trip mode, individual payments) - members amount:', members.map(m => ({ id: m.id, name: m.name, amount: m.amount })));
      }
    } else {
      // 일반 모드: 모든 Payment 계산
      const calculate = new Calculate(members, payments);
      calculate.splitMembers();
      // console.log('After splitMembers (normal mode) - members amount:', members.map(m => ({ id: m.id, name: m.name, amount: m.amount })));
    }

    const result = setDTO(MemberDTO, members) as MemberDTO[];
    // console.log('After setDTO - result amount:', result.map(m => ({ id: m.id, name: m.name, amount: m.amount })));
    
    // 여행 모드인 경우 trip_details 추가
    if (meeting.isTrip) {
      const contributions = await this.contributionRepository.readListByMeetingId(meetingId);
      const contributionMap = new Map<number, number>();
      contributions.forEach(c => {
        contributionMap.set(c.memberId, c.amountKRW);
      });
      
      // 공금 결제와 개인 결제 분리
      const publicPayments = payments.filter(p => {
        const paymentType = (p as any).type || (p.payerId === null ? 'PUBLIC' : 'INDIVIDUAL');
        return paymentType === 'PUBLIC';
      });
      
      const individualPayments = payments.filter(p => {
        const paymentType = (p as any).type || (p.payerId === null ? 'PUBLIC' : 'INDIVIDUAL');
        return paymentType === 'INDIVIDUAL';
      });
      
      // 각 멤버별 trip_details 계산
      result.forEach(memberDTO => {
        const memberId = memberDTO.id;
        if (!memberId) return;
        
        // paid_contribution: 낸 공금
        const paidContribution = contributionMap.get(memberId) || 0;
        
        // paid_advance: 개인 카드로 긁은 선결제/지출 총액
        const paidAdvance = individualPayments
          .filter((p: any) => p.payerId === memberId)
          .reduce((sum: number, p: any) => sum + p.price, 0);
        
        // total_credit
        const totalCredit = paidContribution + paidAdvance;
        
        // used_public: 공금 사용액 중 내 지분
        let usedPublic = 0;
        publicPayments.forEach((payment: any) => {
          if (payment.attendMemberIds && payment.attendMemberIds.includes(memberId)) {
            const attendCount = payment.attendMemberIds.length;
            if (attendCount > 0) {
              // 공통 지출은 균등 분배, 개인 지출은 전액 부담
              if (attendCount === 1) {
                usedPublic += payment.price;
              } else {
                usedPublic += payment.price / attendCount;
              }
            }
          }
        });
        
        // used_individual: 개인 지출 중 내 지분
        let usedIndividual = 0;
        individualPayments.forEach((payment: any) => {
          if (payment.attendMemberIds && payment.attendMemberIds.includes(memberId)) {
            const attendCount = payment.attendMemberIds.length;
            if (attendCount > 0) {
              usedIndividual += payment.price / attendCount;
            }
          }
        });
        
        // total_debit
        const totalDebit = usedPublic + usedIndividual;
        
        // balance (검산용)
        const balance = totalCredit - totalDebit;
        
        // trip_details 추가
        (memberDTO as any).trip_details = {
          paid_contribution: Math.round(paidContribution),
          paid_advance: Math.round(paidAdvance),
          total_credit: Math.round(totalCredit),
          used_public: Math.round(usedPublic),
          used_individual: Math.round(usedIndividual),
          total_debit: Math.round(totalDebit),
          balance: Math.round(balance),
        };
      });
    }
    
    return result;
  }
}

