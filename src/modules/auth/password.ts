import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const bcrypt = require("bcryptjs") as {
  compare(password: string, hash: string): Promise<boolean>;
  hash(password: string, saltOrRounds: number): Promise<string>;
};

const PASSWORD_SALT_ROUNDS = 10;

export interface PasswordVerifier {
  compare(password: string, passwordHash: string): Promise<boolean>;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
}

export const bcryptPasswordVerifier: PasswordVerifier = {
  compare(password, passwordHash) {
    return bcrypt.compare(password, passwordHash);
  }
};

export const bcryptPasswordHasher: PasswordHasher = {
  hash(password) {
    return bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
  }
};
