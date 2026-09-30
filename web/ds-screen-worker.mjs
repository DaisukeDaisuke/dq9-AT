import {detectDSScreens} from './ds-screen-detect.mjs';
self.onmessage=({data})=>{try{self.postMessage({id:data.id,result:detectDSScreens(data.image)});}catch(error){self.postMessage({id:data.id,error:error.message});}};
