/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getIdTokenFromMetadata,
  exchangeVmJwtForToken,
  getStudioAuthToken,
} from './studioAuth.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('studioAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('getIdTokenFromMetadata', () => {
    it('should fetch ID token from metadata server successfully', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        text: async () => 'test-id-token',
      } as Response);

      const token = await getIdTokenFromMetadata();

      expect(token).toBe('test-id-token');
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('metadata.google.internal'),
        {
          method: 'GET',
          headers: {
            'Metadata-Flavor': 'Google',
          },
        },
      );
    });

    it('should retry on failure and eventually succeed', async () => {
      vi.mocked(fetch)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          text: async () => 'test-id-token',
        } as Response);

      const token = await getIdTokenFromMetadata();

      expect(token).toBe('test-id-token');
      expect(fetch).toHaveBeenCalledTimes(3);
    });

    it('should throw error after max retries', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

      await expect(getIdTokenFromMetadata()).rejects.toThrow(
        'Failed to get ID token from metadata server',
      );
      expect(fetch).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });

    it('should handle HTTP error responses', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'Not found',
      } as Response);

      await expect(getIdTokenFromMetadata()).rejects.toThrow();
      expect(fetch).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });
  });

  describe('exchangeVmJwtForToken', () => {
    it('should exchange ID token for service account token', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: 'test-service-token',
          expires_in: 3600,
        }),
      } as Response);

      const result = await exchangeVmJwtForToken('id-token', 'api-key');

      expect(result).toEqual({
        token: 'test-service-token',
        expiresIn: 3600,
      });
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('exchangeVmJwtForToken'),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            Accept: 'application/json',
            'X-Idx-Idtoken': 'id-token',
            'X-Goog-Api-Key': 'api-key',
          },
        },
      );
    });

    it('should throw error on failed token exchange', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Invalid token',
      } as Response);

      await expect(
        exchangeVmJwtForToken('bad-token', 'api-key'),
      ).rejects.toThrow('Token exchange failed (401)');
    });
  });

  describe('getStudioAuthToken', () => {
    it('should return token from environment variable if set', async () => {
      vi.stubEnv('STUDIO_AUTH_TOKEN', 'env-token');

      const token = await getStudioAuthToken();

      expect(token).toBe('env-token');
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should fetch token from metadata server when env var not set', async () => {
      vi.stubEnv('API_KEY', 'test-api-key');
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          text: async () => 'metadata-id-token',
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            token: 'fetched-service-token',
            expires_in: 3600,
          }),
        } as Response);

      const token = await getStudioAuthToken();

      expect(token).toBe('fetched-service-token');
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('should throw error if API_KEY is not set', async () => {
      vi.stubEnv('STUDIO_AUTH_TOKEN', undefined);
      vi.stubEnv('API_KEY', undefined);

      await expect(getStudioAuthToken()).rejects.toThrow(
        'API_KEY environment variable is required',
      );
    });

    it('should throw error if token is empty', async () => {
      vi.stubEnv('API_KEY', 'test-api-key');
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          text: async () => 'metadata-id-token',
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            token: '',
            expires_in: 3600,
          }),
        } as Response);

      await expect(getStudioAuthToken()).rejects.toThrow(
        'Studio auth token is not set or empty',
      );
    });
  });
});
