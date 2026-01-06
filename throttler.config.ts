import { ThrottlerModuleOptions } from '@nestjs/throttler';

export const throttlerConfig: ThrottlerModuleOptions = {
  throttlers: [
    {
      name: 'short',
      ttl: 1000, // 1 second
      limit: 3, // 3 requests per second
    },
    {
      name: 'medium',
      ttl: 60000, // 1 minute
      limit: 20, // 20 requests per minute
    },
    {
      name: 'long',
      ttl: 900000, // 15 minutes
      limit: 100, // 100 requests per 15 minutes
    },
  ],
};