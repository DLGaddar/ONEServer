import { z } from 'zod';
export const serverSchema = z.object({
    id: z.string().uuid(),
    nickname: z.string().min(1, 'Nickname is required').max(100),
    ip: z.string().refine((val) => {
        const ipv4Regex = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
        const domainRegex = /^([a-zA-Z0-9]+(-[a-zA-Z0-9]+)*\.)+[a-zA-Z]{2,}$/;
        return ipv4Regex.test(val) || ipv6Regex.test(val) || domainRegex.test(val) || val === 'localhost';
    }, { message: 'Must be a valid IP address, IPv6, domain name, or localhost' }),
    port: z.number().int().min(1, 'Port must be >= 1').max(65535, 'Port must be <= 65535'),
    username: z.string().min(1, 'Username is required'),
    keyPath: z.string().nullable().optional(),
    createdAt: z.string(),
    updatedAt: z.string()
});
export const createServerSchema = serverSchema.omit({ id: true, createdAt: true, updatedAt: true });
export const updateServerSchema = serverSchema.omit({ createdAt: true, updatedAt: true }).partial().extend({
    id: z.string().uuid()
});
