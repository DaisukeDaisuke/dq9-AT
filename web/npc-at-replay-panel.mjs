import {PRODUCTION_AT_INPUT_NOTICE} from './production-at-input-policy.mjs?v=production-inputs-20261006-1320';
// The old runtime-origin/external-clock file UI is historical source outside web.
// No query flag, message property or caller option re-enables it in production.
export function attachNpcReplayPanel(root){
 root.textContent=PRODUCTION_AT_INPUT_NOTICE+' NPC開始snapshot・外部時計の入力は受け付けません。';
 return {clear(){}};
}
