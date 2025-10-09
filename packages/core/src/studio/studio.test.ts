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

vi.mock('@google/genai');

const mockConfig = {} as unknown as Config;

describe('createStudioContentGenerator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should create a Studio content generator with valid token', async () => {
    vi.stubEnv('STUDIO_AUTH_TOKEN', 'test-studio-token');

    const mockGenerator = {
      models: {},
    } as unknown as GoogleGenAI;
    vi.mocked(GoogleGenAI).mockImplementation(() => mockGenerator as never);

    const generator = await createStudioContentGenerator(
      AuthType.STUDIO,
      mockConfig,
    );

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

  it('should throw error if STUDIO_AUTH_TOKEN is not set', async () => {
    vi.stubEnv('STUDIO_AUTH_TOKEN', undefined);

    await expect(
      createStudioContentGenerator(AuthType.STUDIO, mockConfig),
    ).rejects.toThrow(
      'STUDIO_AUTH_TOKEN environment variable is required for Studio authentication',
    );
  });

  it('should throw error for unsupported auth type', async () => {
    await expect(
      createStudioContentGenerator(AuthType.USE_GEMINI, mockConfig),
    ).rejects.toThrow('Unsupported authType: gemini-api-key');
  });
});
