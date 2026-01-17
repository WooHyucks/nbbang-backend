/**
 * Custom Exceptions
 * Python의 base/exceptions.py와 동일한 예외 클래스
 */

export class CustomException extends Error {
  public statusCode: number;
  public detail: string;

  constructor(statusCode: number, detail: string) {
    super(detail);
    this.statusCode = statusCode;
    this.detail = detail;
    this.name = this.constructor.name;
  }
}

export class InvalidTokenException extends CustomException {
  constructor() {
    super(401, '유효하지 않은 인증 토큰입니다.');
  }
}

export class MissingTokenException extends CustomException {
  constructor() {
    super(401, '인증 토큰이 없습니다.');
  }
}

export class MeetingUserMismatchException extends CustomException {
  constructor(userId: number, meetingId: number) {
    super(403, `${userId} 사용자는 ${meetingId} 모임의 관리자가 아닙니다.`);
  }
}

export class LeaderAlreadyException extends CustomException {
  constructor() {
    super(409, '이미 리더가 있습니다.');
  }
}

export class PaymentInMemberDeleteException extends CustomException {
  constructor() {
    super(409, '결제내역에 포함된 멤버는 삭제할 수 없습니다.');
  }
}

export class MemberIsLeaderDeleteException extends CustomException {
  constructor() {
    super(409, '리더 멤버는 삭제할 수 없습니다.');
  }
}

export class SharePageNotMeetingException extends CustomException {
  constructor() {
    super(404, '공유된 정산이 삭제되었거나 유효하지 않습니다.');
  }
}

export class IncompleteShareException extends CustomException {
  constructor() {
    super(204, '공유된 정산은 완료되지 않았습니다.');
  }
}

export class NotAgreementException extends CustomException {
  constructor() {
    super(403, '이용약관에 동의해야합니다.');
  }
}

export class IdentifierAlreadyException extends CustomException {
  constructor(_identifier: string) {
    super(409, '이미 사용중인 아이디입니다.');
  }
}

export class IdentifierNotFoundException extends CustomException {
  constructor(_identifier: string) {
    super(401, '아이디 또는 비밀번호가 일치하지 않습니다.');
  }
}

export class PasswordNotMatchException extends CustomException {
  constructor(_identifier: string, _password: string) {
    super(401, '아이디 또는 비밀번호가 일치하지 않습니다.');
  }
}

