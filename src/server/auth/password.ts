import { hash, verify } from "@node-rs/argon2";

/** Argon2id (the library default) with its recommended parameters. */
export async function hashPassword(password: string): Promise<string> {
  return hash(password);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | null = null;
/** Burn equivalent CPU for unknown accounts so login timing does not reveal which emails exist. */
export async function verifyDummy(password: string): Promise<void> {
  dummyHash ??= hashPassword("lifted-dummy-password-1");
  await verifyPassword(await dummyHash, password);
}
