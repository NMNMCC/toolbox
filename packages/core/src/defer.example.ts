import * as defer from "./defer.ts"

const add = async (input: {a: number; b: number}) => input.a + input.b
const deferred = defer.defer(add)({a: 2})

console.log(await deferred({b: 3})) // 5
