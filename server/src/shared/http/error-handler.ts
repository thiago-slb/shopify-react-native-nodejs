import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { AppError } from '../errors/app-error.js';

type ErrorPayload = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export function errorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  if ('validation' in error && error.validation) {
    reply.status(400).send({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: error.validation
      }
    } satisfies ErrorPayload);
    return;
  }

  if (error instanceof ZodError) {
    reply.status(400).send({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: error.flatten()
      }
    } satisfies ErrorPayload);
    return;
  }

  if (error instanceof AppError) {
    request.log.warn(
      { err: error, code: error.code, logDetails: error.logDetails, requestId: request.id },
      error.message
    );
    reply.status(error.statusCode).send({
      error: {
        code: error.code,
        message: error.message,
        details: error.details
      }
    } satisfies ErrorPayload);
    return;
  }

  request.log.error({ err: error }, 'Unhandled request error');
  reply.status(500).send({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Unexpected server error'
    }
  } satisfies ErrorPayload);
}
