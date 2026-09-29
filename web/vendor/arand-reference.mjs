// ARand and rightShift copied verbatim from supplied rand.js; build/runtime reference.
function ARand(seed){
    let before = seed;
    seed = seed * BigInt("0x41C64E6D");
    seed = seed + BigInt("0x3039");
    seed = seed & BigInt("0xFFFFFFFF");

    let ret = BigInt("0x7FFF") & rightShift(seed,0x10);
    return [seed, ret];
}
function rightShift(num, shift) { // >>
    return num / (2n ** BigInt(shift));
}
export {ARand};
