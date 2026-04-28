import type { FastifyReply, FastifyRequest } from 'fastify';
import type { z } from 'zod';

export function parseRequestPart<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  value: unknown
): z.infer<TSchema> {
  return schema.parse(value) as z.infer<TSchema>;
}

export async function notFoundHandler(
  _request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  await reply.status(404).send({
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: 'Route not found'
    }
  });
}
