import {
    PublicClientApplication,
    DeviceCodeRequest,
    AccountInfo,
    AuthenticationResult,
} from '@azure/msal-node';
import { redis } from './cache';
import { logger } from './logger';

const OUTLOOK_CLIENT_ID = process.env.OUTLOOK_CLIENT_ID ?? '';
const OUTLOOK_EMAIL = process.env.OUTLOOK_EMAIL ?? '';
const REDIS_TOKEN_KEY = `outlook:oauth:${OUTLOOK_EMAIL}`;

// Microsoft's common endpoint for personal accounts
const msalConfig = {
    auth: {
        clientId: OUTLOOK_CLIENT_ID,
        authority: 'https://login.microsoftonline.com/consumers',
    },
};

const pca = new PublicClientApplication(msalConfig);

// IMAP scope for Outlook
const scopes = [
    'https://outlook.office.com/IMAP.AccessAsUser.All',
    'offline_access',
];

interface StoredToken {
    accessToken: string;
    refreshToken: string;
    expiresOn: number;
    account: AccountInfo;
}

async function getStoredToken(): Promise<StoredToken | null> {
    const stored = await redis.get(REDIS_TOKEN_KEY);
    if (!stored) return null;
    try {
        return JSON.parse(stored) as StoredToken;
    } catch {
        return null;
    }
}

async function storeToken(result: AuthenticationResult): Promise<void> {
    if (!result.account) {
        throw new Error('No account in authentication result');
    }

    const token: StoredToken = {
        accessToken: result.accessToken,
        refreshToken: (result as { refreshToken?: string }).refreshToken || '',
        expiresOn: result.expiresOn?.getTime() || Date.now() + 3600000,
        account: result.account,
    };

    // Store with no expiry - we'll handle refresh ourselves
    await redis.set(REDIS_TOKEN_KEY, JSON.stringify(token));
    logger.info('OAuth token stored in Redis');
}

export async function getAccessToken(): Promise<string> {
    const stored = await getStoredToken();

    if (!stored) {
        throw new Error(
            'No OAuth token found. Run the app with --outlook-auth to authenticate.',
        );
    }

    // Check if token is expired (with 5 min buffer)
    const isExpired = Date.now() > stored.expiresOn - 300000;

    if (!isExpired) {
        return stored.accessToken;
    }

    // Token expired, try to refresh using silent acquisition
    logger.info('Access token expired, refreshing...');

    try {
        const silentRequest = {
            account: stored.account,
            scopes,
            forceRefresh: true,
        };

        const result = await pca.acquireTokenSilent(silentRequest);
        await storeToken(result);
        return result.accessToken;
    } catch (error) {
        logger.error(`Failed to refresh token: ${error}`);
        throw new Error(
            'Failed to refresh OAuth token. Run the app with --outlook-auth to re-authenticate.',
        );
    }
}

export async function authenticateWithDeviceCode(): Promise<void> {
    if (!OUTLOOK_CLIENT_ID) {
        throw new Error(
            'OUTLOOK_CLIENT_ID is not set in environment variables',
        );
    }

    const deviceCodeRequest: DeviceCodeRequest = {
        scopes,
        deviceCodeCallback: (response) => {
            console.log('\n' + '='.repeat(60));
            console.log('OUTLOOK OAUTH2 AUTHENTICATION');
            console.log('='.repeat(60));
            console.log('');
            console.log('1. Open this URL in your browser:');
            console.log(`   ${response.verificationUri}`);
            console.log('');
            console.log('2. Enter this code:');
            console.log(`   ${response.userCode}`);
            console.log('');
            console.log('3. Sign in with your Microsoft account');
            console.log('');
            console.log('='.repeat(60) + '\n');
        },
    };

    try {
        logger.info('Starting device code authentication flow...');
        logger.info(`Using client ID: ${OUTLOOK_CLIENT_ID.substring(0, 8)}...`);

        const result = await pca.acquireTokenByDeviceCode(deviceCodeRequest);

        if (result) {
            await storeToken(result);
            console.log('\nAuthentication successful!');
            console.log(`Authenticated as: ${result.account?.username}`);
            console.log(
                'Token stored in Redis. You can now run the app normally.\n',
            );
        }
    } catch (error: unknown) {
        const err = error as Error;
        logger.error(`Authentication failed: ${err.message}`);

        if (err.message.includes('invalid_grant')) {
            console.log('\nTROUBLESHOOTING:');
            console.log('1. Go to Azure Portal > Your App > Authentication');
            console.log('2. Enable "Allow public client flows" = Yes');
            console.log('3. Save and try again\n');
        }

        throw error;
    }
}

export function generateXOAuth2Token(
    user: string,
    accessToken: string,
): string {
    // XOAUTH2 format: base64("user=" + user + "\x01auth=Bearer " + accessToken + "\x01\x01")
    const authString = `user=${user}\x01auth=Bearer ${accessToken}\x01\x01`;
    return Buffer.from(authString).toString('base64');
}
