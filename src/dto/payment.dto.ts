import { Payment } from '../domains/payment.domain';

/**
 * Payment DTO
 * Python의 base/dto.py의 PaymentDTO와 동일
 */
export class PaymentDTO {
  public id: number | null;
  public place: string;
  public price: number;
  public splitPrice?: number;
  public payMember?: string;
  public attendMember?: string[];
  public attendMemberIds: number[];

  constructor(payment: Payment) {
    this.id = payment.id;
    this.place = payment.place;
    this.price = payment.price;
    this.splitPrice = payment.splitPrice;
    this.payMember = payment.payMember;
    this.attendMember = payment.attendMember;
    this.attendMemberIds = payment.attendMemberIds;
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

