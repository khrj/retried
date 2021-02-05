export default class RetryOperation {
    /**
     * An int representing the number of attempts it took 
     * to call `fn` before it was successful.
     */
    public attempts: number

    /**
     * An array of all errors that have been passed to `retryOperation.retry()` so far. 
     * The returning array has the errors ordered chronologically based on when
     * they were passed to `retryOperation.retry()`, which means the first passed
     * error is at index zero and the last is at the last index.
     */
    public errors: Error[]

    options: {
        forever: boolean,
        maxRetryTime: number
    }

    originalTimeouts: number[]
    timeouts: number[]

    timeout: number | undefined
    operationTimeout: number | undefined
    operationTimeoutFn: ((attempts: number) => void) | undefined

    operationStart: number | undefined
    timer: number | undefined
    cachedTimeouts: number[] | undefined
    maxRetryTime: number
    fn: ((attempts: number) => any) | undefined

    /**
     * Creates a new `RetryOperation`
     * 
     * @param timeouts An array where each value is a timeout given in milliseconds.
     * @param options.forever Whether to retry forever, defaults to `false`.
     * @param options.maxRetryTime Amount of maximum time to retry for before rejecting promise
     * 
     * If `forever` is true, the following changes happen:
     * - `RetryOperation.errors()` will only output an array of one item: the last error.
     * - `RetryOperation` will repeatedly use the `timeouts` array. Once all of its timeouts have been used up, it restarts with the first timeout, then uses the second and so on.
     */
    constructor(timeouts: number[], options: { forever: boolean, maxRetryTime: number }) {
        this.originalTimeouts = timeouts.slice()
        this.timeouts = timeouts

        this.options = options
        this.maxRetryTime = options.maxRetryTime
        this.errors = []
        this.attempts = 1

        if (this.options.forever) {
            this.cachedTimeouts = this.timeouts.slice(0)
        }
    }

    /**
     * Resets the internal state of the operation object, so that you can call `attempt()` again as if this was a new operation object.
     */
    reset() {
        this.attempts = 1
        this.timeouts = this.originalTimeouts.slice(0)
    }

    /**
     * Allows you to stop the operation being retried. Useful for aborting the operation on a fatal error etc.
     */
    stop() {
        if (this.timeout) {
            clearTimeout(this.timeout)
        }

        if (this.timer) {
            clearTimeout(this.timer)
        }

        this.timeouts = []
        this.cachedTimeouts = undefined
    }

    /**
     * @param fn 
     * Function that is to be retried and executed for the first time right away.
     * The `fn` function recieves a single parameter representing the number of attempts so far.
     * 
     * @param timeoutOptions Operation `timeout` in miliseconds 
     * @param timeoutOptions.operationTimeoutFn A function to be called on operation timeout
     * 
     * Whenever your retry operation takes longer than `timeout` to execute, the timeout function is called.
     */
    attempt(fn: (attempts: number) => any, timeoutOptions?: {
        timeout?: number,
        operationTimeoutFn: (attempts: number) => any
    }) {
        this.fn = fn
        this.operationStart = new Date().getTime()
        this.fn(this.attempts)

        if (timeoutOptions && timeoutOptions.timeout && timeoutOptions.operationTimeoutFn) {
            this.operationTimeout = timeoutOptions.timeout
            this.operationTimeoutFn = timeoutOptions.operationTimeoutFn

            setTimeout(() => {
                timeoutOptions.operationTimeoutFn(this.attempts)
            }, timeoutOptions.timeout)
        }
    }

    /**
     * This function should be called after a successful request
     */
    succeed() {
        clearTimeout(this.timeout)
    }

    /**
     * Returns `false` when no `error` value is given, 
     * or the maximum amount of retries has been reached.
     * Otherwise it returns `true`, and retries the operation after the timeout for
     * the current attempt number. 
     */
    async retry(err: Error): Promise<boolean> {
        if (this.timeout) {
            clearTimeout(this.timeout)
        }

        const currentTime = new Date().getTime()
        if (err && this.operationStart && currentTime - this.operationStart >= this.maxRetryTime) {
            this.errors.push(err)
            this.errors.unshift(new Error('RetryOperation timeout occurred'))
            return false
        }

        this.errors.push(err)

        let timeout = this.timeouts.shift()
        if (timeout === undefined) {
            if (this.cachedTimeouts) {
                // retry forever, only keep last error
                this.errors.splice(0, this.errors.length - 1)
                timeout = this.cachedTimeouts.slice(-1)[0]
            } else {
                return false
            }
        }

        const self = this
        await new Promise(resolve => { self.timer = setTimeout(resolve, timeout) })

        this.attempts++
        this.fn!(self.attempts)

        self.timeout = setTimeout(() => {
            self.operationTimeoutFn!(this.attempts)
        }, self.operationTimeout)

        return true
    }

    /**
     * Gets a reference to the error object that occured most frequently. Errors are
     * compared using the `error.message` property.
     * 
     * If multiple error messages occured the same amount of time, the last error
     * object with that message is returned.
     * 
     * If no errors occured so far, the value is `null` .
     */
    getMainError() {
        interface ErrorMessage {
            // errorMessage: count 
            [key: string]: number
        }

        let counts: ErrorMessage = {}

        let mainError
        let mainErrorCount = 0

        for (const error of this.errors) {
            const count = (counts[error.message] || 0) + 1
            counts[error.message] = count

            if (count >= mainErrorCount) {
                mainError = error
                mainErrorCount = count
            }
        }

        return mainError
    }
}