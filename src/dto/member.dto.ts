import { Member } from '@domains/member.domain';

/**
 * Member DTO
 * Python의 base/dto.py의 MemberDTO와 동일
 */
export class MemberDTO {
  public id: number | null;
  public name: string;
  public leader: boolean;
  public amount: number;
  public tippedAmount: number;

  constructor(member: Member) {
    this.id = member.id;
    this.name = member.name;
    this.leader = member.leader;
    this.amount = member.amount;
    this.tippedAmount = member.tippedAmount;
  }
}

/**
 * Python: def set_DTO(DTO, domains)
 */
export function setDTO<T, D>(DTO: new (domain: D) => T, domains: D[] | D): T[] | T {
  if (Array.isArray(domains)) {
    return domains.map((domain) => new DTO(domain));
  } else {
    return new DTO(domains);
  }
}

