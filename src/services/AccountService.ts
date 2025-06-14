import BaseTableStorageService, { escapeODataValue } from "./BaseTableStorageService";

export interface Account {
  pubkey: string;
  email?: string;
  username?: string;
  createdAt: Date;
  updatedAt: Date;
  lastLoginDate?: Date;
}

type CreateAccountDto = Pick<Account, 'pubkey' | 'email'>

class AccountService extends BaseTableStorageService<Account> {
  constructor() {
    super("accounts");
  }

  async addAccount({ pubkey, email }: CreateAccountDto): Promise<Account> {
    const now = new Date();

    const account: Account = {
      pubkey,
      email,
      createdAt: now,
      updatedAt: now,
    };

    await this.tableClient.upsertEntity({
      partitionKey: 'account',
      rowKey: pubkey,
      ...account,
    }, 'Replace')

    return account;
  }

  async isUsernameTaken(username: string, excludePubkey?: string): Promise<boolean> {
    try {
      // Query for any account with this username, excluding the current account if specified
      const filter = excludePubkey
        ? `username eq ${escapeODataValue(username)} and rowKey ne ${escapeODataValue(excludePubkey)}`
        : `username eq ${escapeODataValue(username)}`;

      const entities = await this.queryEntities(filter);
      return entities.length > 0;
    } catch (error) {
      throw new Error(`Failed to check username uniqueness: ${(error as Error).message}`);
    }
  }

  async updateAccount(account: Account): Promise<Account> {
    // If username is being set or changed, check for uniqueness
    if (account.username) {
      const isTaken = await this.isUsernameTaken(account.username, account.pubkey);
      if (isTaken) {
        throw new Error('Username is already taken');
      }
    }

    const updated: Account = {
      ...account,
      updatedAt: new Date()
    };

    await this.tableClient.upsertEntity({
      partitionKey: 'account',
      rowKey: account.pubkey,
      ...updated,
    }, 'Replace');

    return updated;
  }

  async getAccount(pubkey: string): Promise<Account | null> {
    return this.getEntity('account', pubkey)
  }

  async getAccountByUsername(username: string): Promise<Account | null> {
    try {
      // Ineffective query.
      // TODO: either needs a second row `{ rowKey: username, pubkey }` and 
      // then a second query or move to Cosmos DB with secondary index on `username`
      const entities = await this.queryEntities(`username eq ${escapeODataValue(username)}`);
      return entities.length > 0 ? entities[0] : null;
    } catch (error) {
      throw new Error(`Failed to get account by username: ${(error as Error).message}`);
    }
  }
}

export default new AccountService();