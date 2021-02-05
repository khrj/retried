import RetryOperation from './retryOperation.ts'


/**
 * Create Timeout Options, passed to retried.createTimeout
 */
export interface CreateTimeoutOptions {
    /** The exponential factor to use. Default is `2`. */
    factor?: number,

    /** The number of milliseconds before starting the first retry. Default is `1000`. */
    minTimeout?: number,

    /** The maximum number of milliseconds between two retries. Default is `Infinity`. */
    maxTimeout?: number,

    /** Randomizes the timeouts by multiplying with a factor between `1` to `2`. Default is `false`. */
    randomize?: boolean,
}

/**
 * Timeout Options, passed to retried.timeouts
 */
export interface TimeoutsOptions extends CreateTimeoutOptions {
    /** The maximum amount of times to retry the operation. 
     * Default is `10`. 
     * Seting this to `1` means `do it once, then retry it once`. 
     */
    retries?: number,
}

/**
 * Operation Options, passed to retried.operation
 */
export interface OperationOptions extends TimeoutsOptions {
    /** Whether to retry forever, defaults to `false` */
    forever?: boolean,

    /** The maximum time (in milliseconds) that the retried operation is allowed to run. Default is `Infinity`. */
    maxRetryTime?: number
}

/**
 * Creates a new `RetryOperation` object.
 */
export function operation(options: OperationOptions) {
    const ts = timeouts(options)
    return new RetryOperation(ts, {
        forever: options.forever || options.retries === Infinity,
        maxRetryTime: options.maxRetryTime || Infinity
    })
}

/**
 * All time `params` and return values are in milliseconds.
 * The formula used to calculate the individual timeouts is:
 * 
 * ```
 * Math.min(random * minTimeout * Math.pow(factor, attempt), maxTimeout)
 * ```
 * 
 * Have a look at http://dthain.blogspot.com/2009/02/exponential-backoff-in-distributed.html for a better explanation of approach.
 * If you want to tune your `factor` / `times` settings to attempt the last retry
 * after a certain amount of time, you can use wolfram alpha. For example in order
 * to tune for `10` attempts in `5 minutes`, you can use this equation:
 * https://github.com/tim-kos/node-retry/raw/master/equation.gif
 * 
 * Explaining the various values from left to right:
 * - `k = 0 ... 9`:  The `retries` value (10)
 * - `1000`: The `minTimeout` value in ms (1000)
 * - `x^k`: No need to change this,    `x` will be your resulting factor
 * - `5 * 60 * 1000`: The desired total amount of time for retrying in ms (5 minutes)
 * 
 * To make this a little easier for you, use wolfram alpha to do the calculations:
 * http://www.wolframalpha.com/input/?i=Sum%5B1000*x^k%2C+{k%2C+0%2C+9}%5D+%3D+5+*+60+*+1000
 * 
 * @returns An array of timeouts
 */

export function timeouts(params: TimeoutsOptions) {
    const options = {
        ...{
            retries: 10,
            minTimeout: 1 * 1000,
            maxTimeout: Infinity,
            forever: false
        },
        ...params
    }

    if (options.minTimeout > options.maxTimeout) {
        throw new Error('minTimeout is greater than maxTimeout')
    }

    let timeouts = []
    for (let i = 0; i < options.retries; i++) {
        timeouts.push(createTimeout(i, options))
    }

    if (options.forever && !timeouts.length) {
        timeouts.push(createTimeout(options.retries, options))
    }

    // sort the array numerically ascending
    timeouts.sort((a, b) => a - b)

    return timeouts
}

/**
 * Returns a new `timeout` (integer in milliseconds) based on the given parameters.
 * 
 * `retry.createTimeout()` is used internally by `retry.timeouts()` 
 * and is public for you to be able to create your own timeouts for reinserting an item, 
 * see https://github.com/tim-kos/node-retry/issues/13
 * 
 * @param attempt 
 * An integer representing for which retry the timeout should be calculated. 
 * If your retry operation was executed 4 times you had one attempt and 3 retries. 
 * If you then want to calculate a new timeout, you should set `attempt` to 4 (attempts are zero-indexed).
 */
export function createTimeout(attempt: number, params: CreateTimeoutOptions) {
    const options = {
        ...{
            factor: 2,
            minTimeout: 1 * 1000,
            maxTimeout: Infinity,
            randomize: false,
        },
        ...params
    }

    const random = options.randomize
        ? Math.random() + 1
        : 1

    let timeout = Math.round(random * Math.max(options.minTimeout, 1) * Math.pow(options.factor, attempt))
    timeout = Math.min(timeout, options.maxTimeout)

    return timeout
}