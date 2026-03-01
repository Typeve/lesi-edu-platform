import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const bcrypt = require("bcryptjs") as {
  compare(password: string, hash: string): Promise<boolean>;
};

export interface PasswordVerifier {
  compare(password: string, passwordHash: string): Promise<boolean>;
}

export const bcryptPasswordVerifier: PasswordVerifier = {
  compare(password, passwordHash) {
    return bcrypt.compare(password, passwordHash);
  }
};
