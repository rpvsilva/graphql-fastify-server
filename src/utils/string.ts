import { createHash } from 'crypto';

export const hashString = (str: string): string => createHash('md5').update(str).digest('hex');
