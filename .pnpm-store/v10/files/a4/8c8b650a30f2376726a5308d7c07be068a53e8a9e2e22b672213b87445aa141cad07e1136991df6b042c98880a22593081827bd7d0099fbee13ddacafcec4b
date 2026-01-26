import type { AuthModeType } from '../auth/api.js';
import type { Timestamps } from '../db.js';
export interface DBOAuthSession extends Timestamps {
    id: string;
    provider_config_key: string;
    provider: string;
    connection_id: string;
    callbackUrl: string;
    authMode: AuthModeType;
    connect_session_id: number | null;
    connection_config: Record<string, string>;
    environment_id: number;
    web_socket_client_id: string | undefined;
    activity_log_id: string;
    code_verifier: string | null;
    request_token_secret: string | null;
}
export interface OAuthSession {
    id: string;
    providerConfigKey: string;
    provider: string;
    connectionId: string;
    callbackUrl: string;
    authMode: AuthModeType;
    connectSessionId: number | null;
    connectionConfig: Record<string, string>;
    environmentId: number;
    webSocketClientId: string | undefined;
    activityLogId: string;
    codeVerifier: string | null;
    requestTokenSecret: string | null;
    createdAt: Date;
    updatedAt: Date;
}
