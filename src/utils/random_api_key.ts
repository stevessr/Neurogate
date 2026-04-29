import { randomFillSync } from "node:crypto";

export default function randomApiKeySecret(): string {
    const buffer = Buffer.alloc(32);
    randomFillSync(buffer);

    // ng stands for neurogate
    return `ng-${buffer.toString('base64url')}`;
}