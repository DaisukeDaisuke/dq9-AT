import {ATKernel,ATSession,replayObservedTrace} from './at-core.mjs';
let session=null,kernel=null,tables=null;
const ready=(async()=>{const [r,t]=await Promise.all([fetch('./wasm/map_render.wasm'),fetch('./data/enc.json')]);if(!r.ok||!t.ok)throw Error('AT資産の取得に失敗しました');const {instance}=await WebAssembly.instantiate(await r.arrayBuffer(),{});kernel=new ATKernel(instance);tables=(await t.json()).main;})();
self.onmessage=async({data:m})=>{try{await ready;let value;
 switch(m.type){
  case 'start':session=new ATSession(m.seed,kernel);value=session.snapshot();break;
  case 'restore':{const restored=ATSession.restore(m.saved,kernel,tables);session=restored;value=session.snapshot();break;}
  case 'context':if(!session)throw Error('initial seedを先に入力してください');session.setMap(m.map);value=session.snapshot();break;
  case 'input':if(!session)throw Error('initial seedを先に入力してください');session.noteInput(m.input);value=session.snapshot();break;
  case 'observe':if(!session)throw Error('initial seedを先に入力してください');value=session.observeMonster(m.observation,tables,m.window);break;
  case 'forecast':if(!session)throw Error('initial seedを先に入力してください');value=session.forecast(tables,m.tableIds,m.targets,m.window,{conditional:m.conditional});break;
  case 'boot-trace':if(!session)throw Error('initial seedを先に入力してください');value=session.ingestBootTrace(m.trace);break;
  case 'replay':value=replayObservedTrace(m.trace,kernel,tables);break;
  case 'export':value=session?.snapshot();break;
  default:throw Error('Unknown AT operation');
 }
 postMessage({id:m.id,type:m.type,ok:true,value});
 }catch(error){postMessage({id:m.id,type:m.type,ok:false,error:error.message});}};
