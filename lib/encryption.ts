import { supabase } from './supabase';

/**
 * Utility to interact with the Supabase Edge Function for encryption/decryption.
 */

export interface EncryptionResult {
  success: boolean;
  iv: string;
  ciphertext: string;
}

export interface DecryptionResult {
  success: boolean;
  data: any;
}

export const encryptionApi = {
  /**
   * Encrypts data via the Supabase Edge Function
   * @param data The JSON object to encrypt
   */
  encrypt: async (data: any): Promise<EncryptionResult> => {
    const { data: result, error } = await supabase.functions.invoke('encrypt', {
      body: { action: 'encrypt', data },
    });

    if (error) {
      console.error('Encryption invocation error:', error);
      throw new Error(error.message || 'Failed to encrypt data');
    }

    return result as EncryptionResult;
  },

  /**
   * Decrypts data via the Supabase Edge Function
   * @param iv The initialization vector
   * @param ciphertext The encrypted string
   */
  decrypt: async (iv: string, ciphertext: string): Promise<DecryptionResult> => {
    const { data: result, error } = await supabase.functions.invoke('encrypt', {
      body: { action: 'decrypt', iv, ciphertext },
    });

    if (error) {
      console.error('Decryption invocation error:', error);
      throw new Error(error.message || 'Failed to decrypt data');
    }

    return result as DecryptionResult;
  }
};
