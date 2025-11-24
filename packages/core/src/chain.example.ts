import * as chain from "./chain.ts"

// Simplex example:
console.log("Simplex example:")

const toUpperCase = async (str: string) => str.toUpperCase()
const addExclamation = async (str: string) => `${str}!`

const excitedUpperCase = chain.simplex(addExclamation).pipe(toUpperCase)

console.log(await excitedUpperCase("hello")) // "HELLO!"

// Duplex example:
console.log("Duplex example:")

const secret = async () => "42"

const auth: chain.Middleware<number, string> = async (id, next) =>
	id === 42 ? next(id) : "Forbidden"

const secure = chain.duplex(secret).pipe(auth)

console.log(await secure(21)) // "Forbidden"
console.log(await secure(42)) // "42"
