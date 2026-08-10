export class GuestAuthResetError extends Error {
  constructor() {
    super("Local guest state could not be cleared completely.");
    this.name = "GuestAuthResetError";
  }
}

export type GuestAuthResetOperations = {
  clearAsyncKeys: () => Promise<boolean>;
  clearSecureCredentials: () => Promise<boolean>;
  clearSecureRecovery: () => Promise<boolean>;
  asyncKeysAreClear: () => Promise<boolean>;
  secureCredentialsAreClear: () => Promise<boolean>;
  secureRecoveryIsClear: () => Promise<boolean>;
};

export async function performLocalGuestReset(operations: GuestAuthResetOperations): Promise<void> {
  const [asyncRemoved, credentialsRemoved, recoveryRemoved] = await Promise.all([
    operations.clearAsyncKeys(),
    operations.clearSecureCredentials(),
    operations.clearSecureRecovery(),
  ]);
  const [asyncClear, credentialsClear, recoveryClear] = await Promise.all([
    operations.asyncKeysAreClear(),
    operations.secureCredentialsAreClear(),
    operations.secureRecoveryIsClear(),
  ]);
  if (
    !asyncRemoved
    || !credentialsRemoved
    || !recoveryRemoved
    || !asyncClear
    || !credentialsClear
    || !recoveryClear
  ) throw new GuestAuthResetError();
}
