import { finalizeEvent, generateSecretKey, getPublicKey, nip19, nip98 } from "nostr-tools";
import { now } from "./now";

export type NIP98Fixture = {
  token: string;
  privateKey: Uint8Array;
  pubkey: string;
}

export const generateNIP98 = async (method = 'GET'): Promise<NIP98Fixture> => {
  const keyPair = generateKeyPair()
  const token = await nip98.getToken('http://localhost:3000/api/notification', method, e => finalizeEvent(e, keyPair.privateKey))
  return {
    ...keyPair,
    token,
  };
};

export const generateKeyPair = () => {
  const sk = generateSecretKey()
  const pubkey = getPublicKey(sk)
  return {
    privateKey: sk,
    pubkey,
  }
}

// Helper function to create a mock iterator
export const createMockIterator = (values: any[]) => ({
  [Symbol.asyncIterator]: () => {
    let index = 0;
    return {
      next: () => Promise.resolve({
        value: values[index],
        done: index++ >= values.length
      })
    };
  }
});
