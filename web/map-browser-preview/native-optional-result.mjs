// The display's optional wait does not own the lifetime of native source work.
// Resolve every rejection into an outcome so a late failure is always observed.
export async function waitForOptionalNativeResult(pending, milliseconds) {
 if (!Number.isFinite(milliseconds) || milliseconds < 0) throw Error('Invalid optional wait');
 const settled=Promise.resolve(pending).then(result=>({status:'result',result}),error=>({status:'error',error}));
 let timer;
 try {
  const first=await Promise.race([settled,new Promise(resolve=>{timer=setTimeout(()=>resolve({status:'pending'}),milliseconds);})]);
  return {...first,settled};
 } finally { clearTimeout(timer); }
}
