import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ParamsDictionary, Query } from 'express-serve-static-core';
import type { z } from 'zod';

export interface RequestSchemas {
  params?: z.ZodType;
  query?: z.ZodType;
  body?: z.ZodType;
}

type Output<T, Fallback> = T extends z.ZodType ? z.output<T> : Fallback;

export type ValidatedRequest<S extends RequestSchemas> = Request<
  Output<S['params'], ParamsDictionary>,
  unknown,
  Output<S['body'], unknown>,
  Output<S['query'], Query>
>;

type Handler<S extends RequestSchemas> = (
  req: ValidatedRequest<S>,
  res: Response,
) => Promise<void> | void;

/** Parses params/query/body with Zod and swaps in the parsed (coerced, defaulted) values. */
function validate(schemas: RequestSchemas): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (schemas.params) req.params = schemas.params.parse(req.params) as ParamsDictionary;
    if (schemas.query) {
      // Express 5 exposes `req.query` as a getter, so it has to be redefined, not assigned.
      Object.defineProperty(req, 'query', {
        value: schemas.query.parse(req.query),
        writable: true,
        enumerable: true,
        configurable: true,
      });
    }
    if (schemas.body) req.body = schemas.body.parse(req.body);
    next();
  };
}

/**
 * Pairs validation with a handler whose `req` is typed from the same schemas, so the two
 * can never drift apart. Usage: `router.get('/', handle({ query }, (req, res) => ...))`.
 */
export function handle<S extends RequestSchemas>(
  schemas: S,
  handler: Handler<S>,
): RequestHandler[] {
  return [validate(schemas), handler as unknown as RequestHandler];
}
