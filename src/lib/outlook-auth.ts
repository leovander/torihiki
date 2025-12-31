import {
    PublicClientApplication,
    DeviceCodeRequest,
    ICachePlugin,
    TokenCacheContext,
    Configuration,
} from '@azure/msal-node';
import { redis } from './cache';
import { logger } from './logger';

const OUTLOOK_CLIENT_ID = process.env.OUTLOOK_CLIENT_ID ?? '';
const OUTLOOK_EMAIL = process.env.OUTLOOK_EMAIL ?? '';
const REDIS_CACHE_KEY = `outlook:msal-cache:${OUTLOOK_EMAIL}`;

// Redis-based cache plugin for MSAL token persistence
const redisCachePlugin: ICachePlugin = {
    beforeCacheAccess: async (
        cacheContext: TokenCacheContext,
    ): Promise<void> => {
        try {
            const cachedData = await redis.get(REDIS_CACHE_KEY);
            if (cachedData) {
                cacheContext.tokenCache.deserialize(cachedData);
                logger.debug('MSAL cache loaded from Redis');
            }
        } catch (error) {
            logger.error(`Failed to load MSAL cache from Redis: ${error}`);
        }
    },
    afterCacheAccess: async (
        cacheContext: TokenCacheContext,
    ): Promise<void> => {
        if (cacheContext.cacheHasChanged) {
            try {
                const serializedCache = cacheContext.tokenCache.serialize();
                await redis.set(REDIS_CACHE_KEY, serializedCache);
                logger.debug('MSAL cache saved to Redis');
            } catch (error) {
                logger.error(`Failed to save MSAL cache to Redis: ${error}`);
            }
        }
    },
};

// Microsoft's common endpoint for personal accounts
const msalConfig: Configuration = {
    auth: {
        clientId: OUTLOOK_CLIENT_ID,
        authority: 'https://login.microsoftonline.com/consumers',
    },
    cache: {
        cachePlugin: redisCachePlugin,
    },
};

const pca = new PublicClientApplication(msalConfig);

// IMAP scope for Outlook
const scopes = [
    'https://outlook.office.com/IMAP.AccessAsUser.All',
    'offline_access',
];

export async function getAccessToken(): Promise<string> {
    // Get all accounts from MSAL's cache (loaded from Redis via plugin)
    const accounts = await pca.getTokenCache().getAllAccounts();

    if (accounts.length === 0) {
        throw new Error(
            'No OAuth token found. Run the app with --outlook-auth to authenticate.',
        );
    }

    // Use the first account (or find specific one by email if needed)
    const account =
        accounts.find(
            (acc) => acc.username.toLowerCase() === OUTLOOK_EMAIL.toLowerCase(),
        ) || accounts[0];

    logger.debug(`Using account: ${account.username}`);

    try {
        // acquireTokenSilent will automatically:
        // - Return cached token if still valid
        // - Use refresh token to get new access token if expired
        // - Cache plugin will persist any changes to Redis
        const result = await pca.acquireTokenSilent({
            account,
            scopes,
        });

        logger.debug('Access token acquired successfully');
        return result.accessToken;
    } catch (error) {
        logger.error(`Failed to acquire token silently: ${error}`);
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
            // Token is automatically cached to Redis via the cache plugin
            console.log('\nAuthentication successful!');
            console.log(`Authenticated as: ${result.account?.username}`);
            console.log(
                'Token cached in Redis. You can now run the app normally.\n',
            );
            logger.info('OAuth tokens cached via MSAL cache plugin');
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
