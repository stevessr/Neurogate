import { socksDispatcher } from "fetch-socks";
import { ProxyAgent } from "undici";
import config from "./config";

function getProxy(): ProxyAgent | undefined {
    if (config.socksProxy?.startsWith('socks')) {
        const hostPort = config.socksProxy.slice('socks5://'.length);
        const spl = hostPort.split(':');
        if (spl.length != 2) throw new Error(`Invalid socks URL: ${config.socksProxy}`);
        const [host, portStr] = spl;
        if (!host || !portStr) throw new Error('Invalid socks URL');
        const port = parseInt(portStr!, 10);
        if (config.socksProxy.startsWith('socks5://')) {
            return socksDispatcher({
                type: 5,
                host,
                port,
            }, {
                connect: {
                    timeout: 3500
                }
            });
        } else if (config.socksProxy.startsWith('socks4://')) {
            return socksDispatcher({
                type: 4,
                host,
                port,
            }, {
                connect: {
                    timeout: 3500
                },
            });
        } else {
            throw new Error(`Unsupported socks schema!`);
        }
    }

    return undefined;
}

export default getProxy;