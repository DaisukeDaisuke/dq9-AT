// enc.json names carry an encounter-kind suffix; IDs, not rendered names, identify targets.
export function canonicalMonsterName(name){return String(name??'').replace(/\s*\((?:normal|trap|通常|罠)\)\s*$/i,'').trim();}
export function metalCatalog(tables){const result=new Map();for(const table of Object.values(tables))for(const m of table.data||[]){const name=canonicalMonsterName(m.monsterName);if(!m.trapMonster&&/^(メタルスライム|メタルブラザーズ|はぐれメタル|メタルキング|プラチナキング)$/.test(name))result.set(Number(m.monsterId),name);}return result;}
