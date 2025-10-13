/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ContentGenerator } from '../core/contentGenerator.js';
import { AuthType } from '../core/contentGenerator.js';
import type { Config } from '../config/config.js';
import { GoogleGenAI } from '@google/genai';
import { getStudioAuthToken } from './studioAuth.js';

export async function createStudioContentGenerator(
  authType: AuthType,
  _config: Config,
  _sessionId?: string,
): Promise<ContentGenerator> {
  if (authType === AuthType.STUDIO) {
    const version = process.env['CLI_VERSION'] || process.version;
    const userAgent = `GeminiCLI/${version} (${process.platform}; ${process.arch})`;

    const authToken = await getStudioAuthToken();

    const httpOptions = {
      baseUrl: 'https://monospace-pa.googleapis.com',
      apiVersion: 'v1',
      headers: {
        'User-Agent': `${userAgent}`,
        Authorization: `Bearer ${authToken}`,
      },
    };

    const googleGenAI = new GoogleGenAI({
      apiKey: '',
      vertexai: false,
      httpOptions,
    });

    return googleGenAI.models;
  }

  throw new Error(`Unsupported authType: ${authType}`);
}
