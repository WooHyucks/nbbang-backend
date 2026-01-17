/**
 * 암호화 모듈 호환성 테스트
 * 
 * 이 테스트는 Python 백엔드와의 호환성을 확인하기 위한 것입니다.
 * 실제 Python 코드로 암호화한 데이터를 복호화할 수 있는지 확인하세요.
 * 
 * 사용 방법:
 * 1. Python 백엔드에서 테스트 데이터를 암호화
 * 2. 암호화된 데이터를 이 테스트에 입력
 * 3. 복호화 결과가 원본과 일치하는지 확인
 */

import { aesEncrypt, aesDecrypt, TossDepositInformation } from '../crypto.util';

describe('Crypto Utility - Python Compatibility Tests', () => {
  // 환경 변수 설정 필요
  beforeAll(() => {
    if (!process.env.ENCRYPT_KEY) {
      process.env.ENCRYPT_KEY = 'test-key-16-bytes'; // 테스트용 16바이트 키
    }
  });

  describe('AES Encryption/Decryption', () => {
    it('should encrypt and decrypt plain text correctly', () => {
      const plaintext = 'test-account-number-123';
      const encrypted = aesEncrypt(plaintext);
      const decrypted = aesDecrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should handle Korean characters', () => {
      const plaintext = '국민은행 1234567890';
      const encrypted = aesEncrypt(plaintext);
      const decrypted = aesDecrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should handle empty string', () => {
      const plaintext = '';
      const encrypted = aesEncrypt(plaintext);
      const decrypted = aesDecrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should produce consistent encrypted output for same input', () => {
      const plaintext = 'consistent-test';
      const encrypted1 = aesEncrypt(plaintext);
      const encrypted2 = aesEncrypt(plaintext);
      
      // ECB 모드는 같은 입력에 대해 같은 출력을 생성
      expect(encrypted1.toString('hex')).toBe(encrypted2.toString('hex'));
    });
  });

  describe('TossDepositInformation Value Object', () => {
    it('should encrypt string inputs automatically', () => {
      const tossInfo = new TossDepositInformation('국민은행', '1234567890');
      
      expect(Buffer.isBuffer(tossInfo.bank)).toBe(true);
      expect(Buffer.isBuffer(tossInfo.accountNumber)).toBe(true);
    });

    it('should decrypt Buffer inputs automatically', () => {
      const bankBuffer = aesEncrypt('국민은행');
      const accountBuffer = aesEncrypt('1234567890');
      
      const tossInfo = new TossDepositInformation(bankBuffer, accountBuffer);
      
      expect(typeof tossInfo.bank).toBe('string');
      expect(typeof tossInfo.accountNumber).toBe('string');
      expect(tossInfo.bank).toBe('국민은행');
      expect(tossInfo.accountNumber).toBe('1234567890');
    });

    it('should provide decrypted getters', () => {
      const tossInfo = new TossDepositInformation('국민은행', '1234567890');
      
      expect(tossInfo.getDecryptedBank()).toBe('국민은행');
      expect(tossInfo.getDecryptedAccountNumber()).toBe('1234567890');
    });
  });

  describe('Python Compatibility', () => {
    /**
     * Python 백엔드에서 생성한 암호화 데이터를 여기에 입력하여 테스트
     * 
     * Python 코드:
     * from base.vo import aes_encrypt
     * encrypted = aes_encrypt("test-data")
     * print(encrypted.hex())  # hex 문자열로 출력
     */
    it.skip('should decrypt data encrypted by Python backend', () => {
      // Python에서 암호화한 hex 문자열을 여기에 입력
      const pythonEncryptedHex = 'YOUR_PYTHON_ENCRYPTED_HEX_STRING_HERE';
      const pythonEncryptedBuffer = Buffer.from(pythonEncryptedHex, 'hex');
      
      const decrypted = aesDecrypt(pythonEncryptedBuffer);
      const expectedPlaintext = 'YOUR_ORIGINAL_PLAINTEXT_HERE';
      
      expect(decrypted).toBe(expectedPlaintext);
    });

    /**
     * Node.js에서 암호화한 데이터를 Python에서 복호화할 수 있는지 확인
     */
    it.skip('should produce data decryptable by Python backend', () => {
      const plaintext = 'test-data-for-python';
      const encrypted = aesEncrypt(plaintext);
      const encryptedHex = encrypted.toString('hex');
      
      // 이 hex 문자열을 Python에서 복호화하여 확인
      console.log('Encrypted hex (for Python):', encryptedHex);
      console.log('Expected plaintext:', plaintext);
      
      // Python 코드:
      // from base.vo import aes_decrypt
      // import binascii
      // encrypted_bytes = binascii.unhexlify(encrypted_hex)
      // decrypted = aes_decrypt(encrypted_bytes)
      // assert decrypted == plaintext
    });
  });
});

