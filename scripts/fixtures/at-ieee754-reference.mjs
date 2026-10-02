// Independent supplemental specification: exact round-to-nearest/ties-to-even
// binary64 operations represented by BigInt rationals. No Number arithmetic is
// used to compute division/multiplication or expected integer outcomes.
export function roundBinary64(numerator,denominator){
 let num=BigInt(numerator),den=BigInt(denominator);if(den<=0n)throw Error('Positive denominator required');
 const negative=num<0n;if(negative)num=-num;
 if(num===0n)return {numerator:0n,denominator:1n,bits:negative?9223372036854775808n:0n,significand:0n,exponent:0};
 let exponent=num.toString(2).length-den.toString(2).length;
 const below=exponent>=0?num<(den<<BigInt(exponent)):(num<<BigInt(-exponent))<den;if(below)exponent--;
 if(exponent < -1022||exponent > 1023)throw Error('Outside normal binary64; ATRandInt inputs stay normal');
 const shift=52-exponent,N=shift>=0?num<<BigInt(shift):num,D=shift>=0?den:den<<BigInt(-shift);
 let significand=N/D;const remainder=N%D;
 if(remainder*2n>D||(remainder*2n===D&&significand%2n===1n))significand++;
 if(significand===9007199254740992n){significand/=2n;exponent++;}
 const fraction=significand-4503599627370496n,bits=(negative?9223372036854775808n:0n)|(BigInt(exponent+1023)<<52n)|fraction;
 let outNum=negative?-significand:significand,outDen=1n;
 if(exponent>=52)outNum<<=BigInt(exponent-52);else outDen<<=BigInt(52-exponent);
 return {numerator:outNum,denominator:outDen,bits,significand,exponent};
}
export function binary64RandInt(r,max){return binary64RandIntTrace(r,max).value;}
export function binary64RandIntTrace(r,max){
 if(!Number.isInteger(r)||r<0||r>32767||!Number.isInteger(max)||max<1||max>32767)throw Error('Outside confirmed draw input domain');
 const divided=roundBinary64(BigInt(r)-1n,32767n),multiplied=roundBinary64(divided.numerator*BigInt(max),divided.denominator);
 return {value:Number(multiplied.numerator/multiplied.denominator),divided,multiplied,rationalValue:Number(BigInt(max)*(BigInt(r)-1n)/32767n)};
}
export function weightedPredicateIEEE(event,r,tables){
 let possible=false,unknown=false;const alternatives=event.tableSpeciesAlternatives;
 if(!alternatives.length)return {possible:true,unknown:true};
 for(const a of alternatives){
  const table=tables?.[String(a.tableId)];
  if(!table||!Number.isInteger(table.maxRand)||table.maxRand<1||table.maxRand>32767||!Array.isArray(table.data)||table.data.some((row)=>!row||!Number.isInteger(row.start)||row.start<0||row.start>32767||!Number.isInteger(row.end)||row.end < -1||row.end>32767||!Number.isInteger(row.monsterId)||row.monsterId<0||row.monsterId>65535||typeof row.trapMonster!=='boolean')){possible=true;unknown=true;continue;}
  const value=binary64RandInt(r,table.maxRand),hits=table.data.filter(row=>value>=row.start&&value<=row.end);
  if(hits.length!==1||hits[0].trapMonster){possible=true;unknown=true;}else if(hits[0].monsterId===a.monsterId)possible=true;
 }
 return {possible,unknown};
}
