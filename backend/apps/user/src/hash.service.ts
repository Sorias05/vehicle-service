import { randomBytes, pbkdf2Sync } from 'crypto';

export class HashService {
  static hash(password: string): string {
    const salt = randomBytes(16).toString('hex');

    const hash = pbkdf2Sync(
      password,
      salt,
      10000,
      64,
      'sha512',
    ).toString('hex');

    return `${salt}:${hash}`;
  }

  static compare(password: string, stored: string): boolean {
    const [salt, originalHash] = stored.split(':');

    const hash = pbkdf2Sync(
      password,
      salt,
      10000,
      64,
      'sha512',
    ).toString('hex');

    return hash === originalHash;
  }
}