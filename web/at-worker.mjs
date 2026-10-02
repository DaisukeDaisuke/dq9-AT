import {compareCandidateTails,verifyCandidateAssociation} from './at-candidate-forecast.mjs';
import {replayNpcContinuation,replayNpcFiles} from './npc-at-replay.mjs';
import {TreasureEntryKernel} from './treasure-entry.mjs';
import {WorldATKernel,MovementATStep,replayWorldPairs} from './world-at.mjs';
import {ATKernel,ATSession,replayObservedTrace} from './at-core.mjs';
import {FieldATKernel} from './field-at.mjs';
import {FieldScheduler,replaySchedulerTrace} from './field-scheduler.mjs';
let session=null,kernel=null,tables=null,fieldKernel=null,candidateForecastEpoch=0;
const ready=(async()=>{const [r,t]=await Promise.all([fetch('./wasm/map_render.wasm'),fetch('./data/enc.json')]);if(!r.ok||!t.ok)throw Error('AT資産の取得に失敗しました');const {instance}=await WebAssembly.instantiate(await r.arrayBuffer(),{});kernel=new ATKernel(instance);fieldKernel=new FieldATKernel(kernel);tables=(await t.json()).main;})();
self.onmessage=async({data:m})=>{try{await ready;let value;
 switch(m.type){
  case 'start':session=new ATSession(m.seed,kernel);value=session.snapshot();break;
  case 'restore':{const restored=ATSession.restore(m.saved,kernel,tables);session=restored;value=session.snapshot();break;}
  case 'context':if(!session)throw Error('initial seedを先に入力してください');session.setMap(m.map);value=session.snapshot();break;
  case 'input':if(!session)throw Error('initial seedを先に入力してください');session.noteInput(m.input);value=session.snapshot();break;
  case 'video-observation':if(!session)throw Error('initial seedを先に入力してください');session.noteVideo(m.observation);value=session.snapshot();break;
  case 'observe':if(!session)throw Error('initial seedを先に入力してください');value=session.observeMonster(m.observation,tables,m.window);break;
  case 'forecast':if(!session)throw Error('initial seedを先に入力してください');value=session.forecast(tables,m.tableIds,m.targets,m.window,{conditional:m.conditional});break;
  case 'field-forecast':if(!session)throw Error('initial seedを先に入力してください');if(!m.context?.resolved)throw Error('フィールド条件が未解決です');value=fieldKernel.forecastNaturalTails({seed:session.seed,position:m.conditional?session.conditionalBound:session.lowerBound,rows:m.context.rows,areaMasks:m.context.areaMasks,timeValues:m.context.timeValues,targetIds:m.targets,window:m.window},tables);break;
  case 'candidate-forecast':{const mine=++candidateForecastEpoch;verifyCandidateAssociation(m.result,session?.snapshot());value=await compareCandidateTails(m.result,m.options,kernel,fieldKernel,tables,{cancelled:()=>mine!==candidateForecastEpoch});break;}
  case 'candidate-forecast-cancel':candidateForecastEpoch++;value={cancelled:true};break;
  case 'boot-trace':if(!session)throw Error('initial seedを先に入力してください');value=session.ingestBootTrace(m.trace);break;
  case 'npc-continuation':value=replayNpcContinuation(m.input);break;
  case 'npc-continuation-files':value=await replayNpcFiles(m.files);break;
  case 'replay':if(m.trace.format==='dq9-npc-replay-v1'){value=replayNpcContinuation(m.trace);break;}if(m.trace.format==='dq9-nonspawn-actual-pairs'){value={world:replayWorldPairs(m.trace,kernel),updates:m.trace.items.length,intCalls:0,spawns:[],mismatches:[]};value.mismatches=value.world.mismatches;break;}value=replayObservedTrace(m.trace,kernel,tables);if(m.trace.schedulerEvents){const contexts={...(m.trace.contexts||{})};const c=m.context;if(c?.resolved&&c.rows?.length&&c.rows.every(r=>(r.flags&7)>1))contexts[String(c.mapId)]={rows:c.rows,timeValue:0,basis:'time-invariant complete map rows'};value.scheduler=replaySchedulerTrace({...m.trace,contexts},fieldKernel,tables);}break;
  case 'unresolved-consumption':if(!session)throw Error('initial seedを先に入力してください');value=session.noteUnresolvedConsumption(m.observation);break;
  case 'treasure-entry':value=new TreasureEntryKernel(kernel).consume(m.state,m.source,{loadComplete:m.loadComplete,initialFlags:m.initialFlags});break;
  case 'movement-elapsed-write':value=new MovementATStep(kernel).elapsedWrite(m.state,m.input);break;
  case 'movement-timer-step':value=new MovementATStep(kernel).timerStep(m.state,m.input);break;
  case 'world-consumers':value=new WorldATKernel(kernel).consume(m.state,m.events);break;
  case 'field-step':value=new FieldScheduler(fieldKernel).step(m.state,m.input,tables);break;
  case 'export':value=session?.snapshot();break;
  default:throw Error('Unknown AT operation');
 }
 postMessage({id:m.id,type:m.type,ok:true,value});
 }catch(error){postMessage({id:m.id,type:m.type,ok:false,error:error.message});}};
