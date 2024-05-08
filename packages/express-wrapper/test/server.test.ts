import test from 'node:test';
import { strict as assert } from 'node:assert';

import * as t from 'io-ts';
import { flow } from 'fp-ts/lib/function';
import supertest from 'supertest';

import { type ApiSpec, apiSpec, httpRequest, httpRoute } from '@api-ts/io-ts-http';
import { buildApiClient, supertestRequestFactory } from '@api-ts/superagent-wrapper';

import { createServer } from '../src';

const PutHello = httpRoute({
  path: '/hello',
  method: 'PUT',
  request: httpRequest({
    body: {
      secretCode: t.number,
    },
  }),
  response: {
    200: t.type({
      message: t.string,
      routeMiddlewareRan: t.boolean,
    }),
    400: t.type({
      errors: t.string,
    }),
    404: t.unknown,
    // DISCUSS: what if a response isn't listed here but shows up?
    500: t.unknown,
  },
});
type PutHello = typeof PutHello;

const GetHello = httpRoute({
  path: '/hello/{id}',
  method: 'GET',
  request: httpRequest({
    params: {
      id: t.string,
    },
  }),
  response: {
    200: t.type({
      id: t.string,
    }),
  },
});

const ApiSpec = apiSpec({
  'hello.world': {
    put: PutHello,
    get: GetHello,
  },
});

// import * as T from 'fp-ts/lib/Task';
// function invokeTask<T>(task: T.Task<T>): Promise<T> {
//   return task();
// }

function routeMiddleware<T>(data: T): T & { routeMiddlewareRan: boolean } {
  return {
    ...data,
    routeMiddlewareRan: true,
  };
}

// DISCUSS: defining a RouteHandler type or something (also used in decodeRequestAndEncodeResponse)
const CreateHelloWorld = (parameters: {
  secretCode: number;
  appMiddlewareRan?: boolean;
  routeMiddlewareRan?: boolean;
}) => {
  // DISCUSS: can we infer the response type from the codec?
  if (parameters.secretCode === 0) {
    return {
      type: 400,
      payload: {
        errors: 'Please do not tell me zero! I will now explode',
      },
    } as const;
  }
  return {
    type: 200,
    payload: {
      message:
        parameters.secretCode === 42
          ? 'Everything you see from here is yours'
          : "Who's there?",
      appMiddlewareRan: parameters.appMiddlewareRan ?? false,
      routeMiddlewareRan: parameters.routeMiddlewareRan ?? false,
    },
  } as const;
};

const GetHelloWorld = async (params: { id: string }) =>
  ({
    type: 'ok',
    payload: params,
  }) as const;

test('should offer a delightful developer experience', async () => {
  const app = createServer(ApiSpec, () => {
    return {
      'hello.world': {
        put: flow(routeMiddleware, (a) => CreateHelloWorld(a)),
        get: GetHelloWorld,
      },
    };
  });

  const server = supertest(app);
  const apiClient = buildApiClient(supertestRequestFactory(server), ApiSpec);

  // DISCUSS: a use-case for decoding as a switch -- if I got this code, run this function

  // DISCUSS: falling back to `t.unknown` codec for unrecognized status codes
  // I guess technically the route should declare what it can send back as an
  // error, but right now we have 400 and 404s thrown by io-ts-server, not the
  // application layer :thonking:
  const response = await apiClient['hello.world']
    .put({ secretCode: 1000 })
    .decodeExpecting(200)
    .then((res) => res.body);

  assert.equal(response.message, "Who's there?");
});

test('should handle io-ts-http formatted path parameters', async () => {
  const app = createServer(ApiSpec, () => {
    return {
      'hello.world': {
        put: flow(routeMiddleware, CreateHelloWorld),
        get: GetHelloWorld,
      },
    };
  });

  const server = supertest(app);
  const apiClient = buildApiClient(supertestRequestFactory(server), ApiSpec);

  const response = await apiClient['hello.world']
    .get({ id: '1337' })
    .decodeExpecting(200)
    .then((res) => res.body);

  assert.equal(response.id, '1337');
});

test('should invoke route-level middleware', async () => {
  const app = createServer(ApiSpec, () => {
    return {
      'hello.world': {
        put: flow(routeMiddleware, CreateHelloWorld),
        get: GetHelloWorld,
      },
    };
  });

  const server = supertest(app);
  const apiClient = buildApiClient(supertestRequestFactory(server), ApiSpec);

  const response = await apiClient['hello.world']
    .put({ secretCode: 1000 })
    .decodeExpecting(200)
    .then((res) => res.body);

  assert.equal(response.message, "Who's there?");
  assert.equal(response.routeMiddlewareRan, true);
});

test('should infer status code from response type', async () => {
  const app = createServer(ApiSpec, () => {
    return {
      'hello.world': {
        put: CreateHelloWorld,
        get: GetHelloWorld,
      },
    };
  });

  const server = supertest(app);
  const apiClient = buildApiClient(supertestRequestFactory(server), ApiSpec);

  const response = await apiClient['hello.world']
    .put({ secretCode: 0 })
    .decodeExpecting(400)
    .then((res) => res.body);

  assert.equal(response.errors, 'Please do not tell me zero! I will now explode');
});

test('should return a 400 when request fails to decode', async () => {
  const app = createServer(ApiSpec, () => {
    return {
      'hello.world': {
        put: CreateHelloWorld,
        get: GetHelloWorld,
      },
    };
  });

  const response = await supertest(app)
    .put('/hello')
    .set('Content-Type', 'application/json')
    .expect(400);

  assert(response.body.error.startsWith('Invalid value undefined supplied to'));
});

// TODO: add a test of async (like with tasks or task eithers)
