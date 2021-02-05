# Retried

Abstraction for exponential and custom retry strategies for failed operations.
This module is a Deno/ES6+/TypeScript rewrite of the popular `retry` nodejs module

## Example

The example below will retry a potentially failing `fetch` operation
`10` times using an exponential backoff strategy. With the default settings, this
means the last attempt is made after `17 minutes and 3 seconds` .

```ts
import * as retried from 'https://deno.land/x/retried@1.0.1/mod.ts'

function faultTolerantFetch(address: string): Promise<Response> {
    return new Promise((resolve, reject) => {
        const operation = retried.operation({})
        operation.attempt(async (currentAttempt: number) => {
            try {
                resolve(await fetch(address))
                operation.succeed()
            } catch (error) {
                console.error(`Attempt ${currentAttempt}, Error:`)
                console.error(error)

                if (await operation.retry(error)) return
                reject(error)
            }
        })
    })
}

try {
    const response = await faultTolerantFetch('http://example.com')
    const body = await response.text()
    console.log(body)
} catch (e) {
    console.error("Fetch failed: ")
    console.error(e)
}
```

You can also configure the factors that go into the exponential
backoff. See the API documentation below for all available settings.

```ts
const operation = retry.operation({
    retries: 5,
    factor: 3,
    minTimeout: 1 * 1000,
    maxTimeout: 60 * 1000,
    randomize: true,
})
```

## API

See:
- https://doc.deno.land/https/deno.land/x/retried@1.0.1/lib/retried.ts and
- https://doc.deno.land/https/deno.land/x/retried@1.0.1/lib/retryOperation.ts

## License

Retried is licensed under the MIT license.
Code is adapted from https://github.com/tim-kos/node-retry (also under the MIT license)
