import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { Request, Response } from "express";

type MessagePayload = string | string[];

/** Map known Prisma errors to honest HTTP codes instead of blanket 500s (audit CQ-8) */
function mapPrismaError(exception: Prisma.PrismaClientKnownRequestError): { status: number; message: string } | null {
  switch (exception.code) {
    case "P2002":
      return { status: HttpStatus.CONFLICT, message: "A record with this value already exists" };
    case "P2025":
      return { status: HttpStatus.NOT_FOUND, message: "Record not found" };
    case "P2003":
      return { status: HttpStatus.BAD_REQUEST, message: "Referenced record does not exist" };
    case "P2023":
      return { status: HttpStatus.BAD_REQUEST, message: "Malformed identifier" };
    default:
      return null;
  }
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let payload: MessagePayload = "Internal server error";

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      const extracted =
        typeof res === "string"
          ? res
          : ((res as Record<string, unknown>).message as MessagePayload | undefined);
      if (extracted) payload = extracted;
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const mapped = mapPrismaError(exception);
      if (mapped) {
        status = mapped.status;
        payload = mapped.message;
      }
    } else if (exception instanceof Error) {
      payload =
        process.env.NODE_ENV === "production" ? "Internal server error" : exception.message;
    }

    const loggable = Array.isArray(payload) ? payload.join(", ") : payload;
    this.logger.error(`${request.method} ${request.url} ${status} - ${loggable}`);

    response.status(status).json({
      statusCode: status,
      message: Array.isArray(payload) ? payload : [payload],
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
