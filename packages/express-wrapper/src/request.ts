/**
 * express-wrapper
 * A simple, type-safe web server
 */

import * as PathReporter from 'io-ts/lib/PathReporter';

import { ApiSpec, HttpRoute, RequestType, ResponseType } from '@api-ts/io-ts-http';
import {
  OnDecodeErrorFn,
  OnEncodeErrorFn,
  TypedRequestHandler,
} from '@api-ts/typed-express-router';

import type { KeyedResponseType, ResponseEncoder } from './response';

// QUESTION: When would I choose to use KeyedResponse vs just Response?
export type RouteHandler<R extends HttpRoute, Input = RequestType<R>> =
  | ((input: Input) => ResponseType<R> | Promise<ResponseType<R>>)
  | ((input: Input) => KeyedResponseType<R> | Promise<KeyedResponseType<R>>);

/**
 * Dynamically assign a function name to avoid anonymous functions in stack traces
 * https://stackoverflow.com/a/69465672
 */
const createNamedFunction = <F extends (...args: any) => void>(
  name: string,
  fn: F,
): F => Object.defineProperty(fn, 'name', { value: name });

export const onDecodeError: OnDecodeErrorFn = (errs, _req, res) => {
  const validationErrors = PathReporter.failure(errs);
  const validationErrorMessage = validationErrors.join('\n');
  res.writeHead(400, { 'Content-Type': 'application/json' });
  res.write(JSON.stringify({ error: validationErrorMessage }));
  res.end();
};

export const onEncodeError: OnEncodeErrorFn = (err, _req, res) => {
  console.warn('Error in route handler:', err);
  res.status(500).end();
};

export const handleRequest = (
  apiName: string,
  httpRoute: HttpRoute,
  handler: RouteHandler<HttpRoute>,
  responseEncoder: ResponseEncoder,
): TypedRequestHandler<ApiSpec> => {
  return createNamedFunction(
    'decodeRequestAndEncodeResponse' + httpRoute.method + apiName,
    async (req, res, next) => {
      try {
        // DISCUSS: also passing req, res, as an escape hatch
        const response = await handler(req.decoded);
        responseEncoder(httpRoute, response)(req, res, next);
      } catch (err) {
        if (!res.statusCode) {
          res.status(500);
        }
        res.end();
        next();
        return;
      }
    },
  );
};
