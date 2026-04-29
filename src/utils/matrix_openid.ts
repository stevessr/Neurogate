import config from "../services/config";
import { resolveMatrixFederationUrl } from "./resolve_matrix_server";

export type MatrixOpenIDData = {
    access_token: string;
    token_type: string;
    matrix_server_name: string;
    expires_in: number;
};

export async function resolveMatrixOpenId(openid: MatrixOpenIDData): Promise<string | null> {
    const fedBaseUrl = await resolveMatrixFederationUrl(openid.matrix_server_name);
    const response = await fetch(`${fedBaseUrl}/_matrix/federation/v1/openid/userinfo?access_token=${openid.access_token}`, {
        headers: {
            'User-Agent': config.userAgent,
        },
    });

    if (!response.ok) return null;
    
    const responseBody: any = await response.json();
    if (typeof responseBody['sub'] !== 'string') return null;
    const sub = responseBody['sub'] as string;
    if (!sub.startsWith('@') || !sub.endsWith(`:${openid.matrix_server_name}`)) return null;

    return sub;
}