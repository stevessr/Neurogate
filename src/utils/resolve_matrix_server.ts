import { fetch } from 'undici';
import config from '../services/config';

export function isValidServerName(serverName: string): boolean {
    const portRegex = /^:\d{1,5}$/;
    const ipv4Regex = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
    const ipv6Regex = /^\[[0-9A-Fa-f:.]{2,45}\]$/;
    const dnsRegex = /^[0-9A-Za-z.-]{1,255}$/;

    // Split hostname and port
    const lastColon = serverName.lastIndexOf(':');
    let hostname = serverName;
    let port = '';

    if (lastColon !== -1 && lastColon !== 0) {
        const possiblePort = serverName.substring(lastColon);
        // Check if it's actually a port (not IPv6 colon)
        if (portRegex.test(possiblePort)) {
            hostname = serverName.substring(0, lastColon);
            port = possiblePort.substring(1);
        }
    }

    // Validate port if present
    if (port && (parseInt(port) > 65535 || parseInt(port) < 1)) {
        return false;
    }

    // Validate hostname
    if (ipv6Regex.test(hostname)) {
        return true; // IPv6
    }

    if (ipv4Regex.test(hostname)) {
        // Validate IPv4 octets are 0-255
        return hostname.split('.').every(octet => parseInt(octet) <= 255);
    }

    if (dnsRegex.test(hostname)) {
        return true; // DNS name
    }

    return false;
}


export async function resolveMatrixFederationUrl(serverName: string): Promise<string> {
    const response = await fetch(`https://${serverName}/.well-known/matrix/server`, {
        headers: {
            'User-Agent': config.userAgent,
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to resolve Matrix federation URL for ${serverName}. Received HTTP ${response.status} ${response.statusText}: ${await response.text()}`);
    }

    const responseBody: any = await response.json();
    if (typeof responseBody['m.server'] !== 'string') throw new Error(`'m.server' field in well-known response was not a string`);

    const mServer = responseBody['m.server'] as string;
    if (!isValidServerName(mServer)) throw new Error(`'m.server' does not seem to be a valid server name`);

    return `https://${mServer}`;
}