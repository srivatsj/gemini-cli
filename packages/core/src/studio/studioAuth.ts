/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

const METADATA_SERVER_URL =
  'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity';
const TOKEN_EXCHANGE_URL =
  'https://monospace-pa.googleapis.com/v1/serviceAccounts:exchangeVmJwtForToken';
const AUDIENCE = 'firebase-studio';
const MAX_RETRIES = 3;
const RETRY_INTERVAL_MS = 500;

export interface StudioAuthToken {
  token: string;
  expiresIn: number;
}

/**
 * Fetches an ID token from the GCP metadata server with retry logic.
 *
 * @throws {Error} If the metadata server call fails after retries
 * @returns Promise resolving to the ID token string
 */
export async function getIdTokenFromMetadata(): Promise<string> {
  const url = new URL(METADATA_SERVER_URL);
  url.searchParams.set('audience', AUDIENCE);
  url.searchParams.set('format', 'full');

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Metadata-Flavor': 'Google',
        },
      });

      if (response.ok) {
        return await response.text();
      }

      const errorBody = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorBody}`);
    } catch (error) {
      if (attempt < MAX_RETRIES) {
        console.warn(
          `Metadata server retry ${attempt + 1}/${MAX_RETRIES}: ${error}`,
        );
        await new Promise((resolve) => setTimeout(resolve, RETRY_INTERVAL_MS));
      } else {
        throw new Error(
          `Failed to get ID token from metadata server after ${MAX_RETRIES} retries: ${error}`,
        );
      }
    }
  }

  throw new Error('Unexpected end of retry logic');
}

/**
 * Exchanges a VM ID token for a service account token.
 *
 * @param idToken - The ID token from the metadata server
 * @param apiKey - The API key for authentication
 * @throws {Error} If the token exchange fails
 * @returns Promise resolving to the service account token data
 */
export async function exchangeVmJwtForToken(
  idToken: string,
  apiKey: string,
): Promise<StudioAuthToken> {
  const response = await fetch(TOKEN_EXCHANGE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Accept: 'application/json',
      'X-Idx-Idtoken': idToken,
      'X-Goog-Api-Key': apiKey,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Token exchange failed (${response.status}): ${response.statusText}, ${errorBody}`,
    );
  }

  const data = (await response.json()) as {
    token: string;
    expires_in: number;
  };

  return {
    token: data.token,
    expiresIn: data.expires_in,
  };
}

/**
 * Gets a Studio authentication token by fetching an ID token from the metadata
 * server and exchanging it for a service account token.
 *
 * @throws {Error} If token retrieval or exchange fails
 * @returns Promise resolving to the access token string
 */
export async function getStudioAuthToken(): Promise<string> {
  // Check for environment variable override (for testing/development)
  const envToken = process.env['STUDIO_AUTH_TOKEN'];
  if (envToken) {
    return envToken;
  }

  const apiKey = process.env['API_KEY'];
  if (!apiKey) {
    throw new Error('API_KEY environment variable is required for Studio auth');
  }

  const idToken = await getIdTokenFromMetadata();
  const authToken = await exchangeVmJwtForToken(idToken, apiKey);

  if (!authToken.token) {
    throw new Error('Studio auth token is not set or empty');
  }

  return authToken.token;
}
