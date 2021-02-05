import * as retried from '../mod.ts'

function faultTolerantFetch(address: string): Promise<Response> {
    return new Promise((resolve, reject) => {
        const operation = retried.operation({})
        operation.attempt(async (currentAttempt: number) => {
            try {
                resolve(await fetch(address))
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
    console.log("Fetch failed.")
    console.error(e)
}