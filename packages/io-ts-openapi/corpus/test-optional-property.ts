//! should read optional properties

/// file: index.ts

import * as t from 'io-ts';
import * as h from '@bitgo/io-ts-http';

const MyRoute = h.httpRoute({
  path: '/test',
  method: 'GET',
  request: h.httpRequest({
    query: {
      req: t.string,
      opt: t.union([t.string, t.undefined]),
    },
  }),
  response: {
    ok: t.string,
  },
});

export const Routes = h.apiSpec({
  'api.v1.test.myroute': {
    get: MyRoute,
  },
});

///

`
{
  "openapi": "3.1.0",
  "info": {
    "title": "test",
    "version": "1"
  },
  "paths": {
    "/test": {
      "get": {
        "summary": "MyRoute",
        "description": "",
        "parameters": [
          {
            "name": "req",
            "description": "",
            "schema": {
              "type": "string"
            },
            "required": true,
            "in": "query"
          },
          {
            "name": "opt",
            "description": "",
            "schema": {
              "type": "string"
            },
            "required": false,
            "in": "query"
          }
        ],
        "responses": {
          "200": {
            "description": "",
            "content": {
              "application/json": {
                "schema": {
                  "type": "string"
                }
              }
            }
          }
        }
      }
    }
  },
  "components": {
    "schemas": {}
  }
}`;
