import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { DomainError } from '../../domain/errors/domain-error';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let message: string;
    let stack: string | undefined;

    // Anything an HttpException put in its body beyond statusCode/message.
    // Without this the response is flattened to four fields and a client
    // cannot tell a disabled feature from any other 503 — which would make
    // GateException's `code` and `feature` decorative.
    let details: Record<string, unknown> = {};

    if (exception instanceof DomainError) {
      status =
        exception.name === 'NotFoundError'
          ? HttpStatus.NOT_FOUND
          : exception.name === 'UnauthorizedError'
            ? HttpStatus.UNAUTHORIZED
            : exception.name === 'ValidationError'
              ? HttpStatus.BAD_REQUEST
              : HttpStatus.INTERNAL_SERVER_ERROR;
      message = exception.message;
      stack = exception.stack;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exResponse = exception.getResponse();
      if (typeof exResponse === 'string') {
        message = exResponse;
      } else {
        const body = exResponse as Record<string, unknown>;
        message = body.message as string;

        details = Object.fromEntries(
          Object.entries(body).filter(
            ([key]) => !['message', 'statusCode', 'error'].includes(key),
          ),
        );
      }
      if (Array.isArray(message)) message = message.join(', ');
      stack = exception.stack;
    } else if (exception instanceof Error) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
      stack = exception.stack;
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
    }

    this.logger.error(
      `${request.method} ${request.url} -> ${status}: ${message}`,
      stack,
    );

    response.status(status).json({
      statusCode: status,
      message,
      ...details,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
