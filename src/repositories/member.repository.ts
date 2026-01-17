import { prisma } from '../utils/prisma.util';
import { Member } from '../domains/member.domain';

/**
 * Member Repository
 * Python의 member/repository.py와 동일한 로직
 */
export class MemberRepository {
  /**
   * Python: def create(self, member: Member)
   */
  async create(member: Member): Promise<void> {
    const memberModel = await prisma.member.create({
      data: {
        name: member.name,
        leader: member.leader,
        meetingId: member.meetingId,
      },
    });
    member.id = memberModel.id;
  }

  /**
   * Python: def update(self, member: Member)
   */
  async update(member: Member): Promise<void> {
    await prisma.member.update({
      where: { id: member.id! },
      data: {
        name: member.name,
        leader: member.leader,
      },
    });
  }

  /**
   * Python: def delete(self, member: Member)
   */
  async delete(member: Member): Promise<void> {
    await prisma.member.delete({
      where: { id: member.id! },
    });
  }

  /**
   * Python: def read_by_id(self, member_id)
   */
  async readById(memberId: number): Promise<Member | null> {
    const memberModel = await prisma.member.findUnique({
      where: { id: memberId },
    });

    if (!memberModel) {
      return null;
    }

    return new Member(
      memberModel.id,
      memberModel.name,
      memberModel.leader,
      memberModel.meetingId,
    );
  }

  /**
   * Python: def read_list_by_meeting_id(self, meeting_id)
   */
  async readListByMeetingId(meetingId: number): Promise<Member[]> {
    const memberModels = await prisma.member.findMany({
      where: { meetingId },
    });

    const members = memberModels.map((model: {
      id: number;
      name: string;
      leader: boolean;
      meetingId: number;
    }) => {
      return new Member(
        model.id,
        model.name,
        model.leader,
        model.meetingId,
      );
    });

    // Python: members = self.__sort_leader(members)
    return this._sortLeader(members);
  }

  /**
   * Python: def __sort_leader(self, members: list[Member])
   */
  private _sortLeader(members: Member[]): Member[] {
    const leaderIndex = members.findIndex((m) => m.leader);
    if (leaderIndex > 0) {
      const leader = members.splice(leaderIndex, 1)[0];
      if (leader) {
        members.unshift(leader);
      }
    }
    return members;
  }

  /**
   * Python: def read_leader_member_by_meeting_id(self, meeting_id)
   */
  async readLeaderMemberByMeetingId(meetingId: number): Promise<Member | null> {
    const memberModel = await prisma.member.findFirst({
      where: {
        meetingId,
        leader: true,
      },
    });

    if (!memberModel) {
      return null;
    }

    return new Member(
      memberModel.id,
      memberModel.name,
      memberModel.leader,
      memberModel.meetingId,
    );
  }

  /**
   * Python: def delete_by_meeting_id(self, meeting_id)
   */
  async deleteByMeetingId(meetingId: number): Promise<void> {
    await prisma.member.deleteMany({
      where: { meetingId },
    });
  }
}

