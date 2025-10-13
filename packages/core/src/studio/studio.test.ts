/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createStudioContentGenerator } from './studio.js';
import { AuthType } from '../core/contentGenerator.js';
import type { Config } from '../config/config.js';
import { GoogleGenAI } from '@google/genai';
import * as studioAuth from './studioAuth.js';

vi.mock('@google/genai');
vi.mock('./studioAuth.js');

const mockConfig = {} as unknown as Config;

describe('createStudioContentGenerator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should create a Studio content generator with valid token', async () => {
    vi.mocked(studioAuth.getStudioAuthToken).mockResolvedValue(
      'test-studio-token',
    );

    const mockGenerator = {
      models: {},
    } as unknown as GoogleGenAI;
    vi.mocked(GoogleGenAI).mockImplementation(() => mockGenerator as never);

    const generator = await createStudioContentGenerator(
      AuthType.STUDIO,
      mockConfig,
    );

    expect(studioAuth.getStudioAuthToken).toHaveBeenCalled();
    expect(GoogleGenAI).toHaveBeenCalledWith({
      apiKey: '',
      vertexai: false,
      httpOptions: {
        baseUrl: 'https://monospace-pa.googleapis.com',
        apiVersion: 'v1',
        headers: {
          'User-Agent': expect.stringContaining('GeminiCLI/'),
          Authorization: 'Bearer test-studio-token',
        },
      },
    });
    expect(generator).toBe(mockGenerator.models);
  });

  it('should throw error if token retrieval fails', async () => {
    vi.mocked(studioAuth.getStudioAuthToken).mockRejectedValue(
      new Error('API_KEY environment variable is required'),
    );

    await expect(
      createStudioContentGenerator(AuthType.STUDIO, mockConfig),
    ).rejects.toThrow('API_KEY environment variable is required');
  });

  it('should throw error for unsupported auth type', async () => {
    await expect(
      createStudioContentGenerator(AuthType.USE_GEMINI, mockConfig),
    ).rejects.toThrow('Unsupported authType: gemini-api-key');
  });
});
