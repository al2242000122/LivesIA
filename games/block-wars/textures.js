(function(root,factory){
  'use strict';
  if(typeof module==='object'&&module.exports)module.exports=factory(root);else root.BlockWarsTextures=factory(root);
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';
  const SOURCE_VERSION='26.3';
  const ORIGINAL_NAMES=Object.freeze(['stone','soil','coal','iron','gold','redstone','lapis','emerald','diamond','copper','granite','diorite','andesite','moss','obsidian','magma','bedrock','wood_pickaxe','stone_pickaxe','gold_pickaxe','diamond_pickaxe','netherite_pickaxe','tnt','tnt_top',...Array.from({length:10},(_,i)=>'destroy_stage_'+i)]);
  const EFFECT_NAMES=Object.freeze({water:[16,0],ice:[16,16],fire:[16,0],arrow:[16,16],dispenser:[16,16],creeper:[64,32],rain:[64,256]});
  let originals=new Map();
  function source(kind,id){
    if(kind==='crack')return Number.isInteger(id)&&id>=0&&id<=9?originals.get('destroy_stage_'+id)||null:null;
    const name=kind==='tool'?`${id}_pickaxe`:kind==='tnt'?'tnt':id==='crystal'?'diamond':id;
    return originals.get(name)||null;
  }
  async function loadOriginals({ImageClass=root.Image,timeoutMs=5000}={}){
    originals=new Map();
    if(typeof ImageClass!=='function')return {ok:false,loaded:0};
    const names=[...ORIGINAL_NAMES,...Object.keys(EFFECT_NAMES)];
    const results=await Promise.allSettled(names.map(name=>new Promise((resolve,reject)=>{
      const image=new ImageClass();
      const timer=setTimeout(()=>finish(false),Math.max(1,Math.min(10000,timeoutMs)));
      function finish(ok){clearTimeout(timer);image.onload=null;image.onerror=null;ok?resolve([name,image]):reject(new Error('Textura local no disponible: '+name));}
      image.onload=()=>{
        const dimensions=EFFECT_NAMES[name];
        finish(dimensions&&dimensions[1]?image.width===dimensions[0]&&image.height===dimensions[1]:image.width===16&&image.height>=16&&image.height<=1024&&image.height%16===0);
      };
      image.onerror=()=>finish(false);image.src='/block-wars/assets/'+name+'.png';
    })));
    if(results.slice(0,ORIGINAL_NAMES.length).some(result=>result.status==='rejected'))return {ok:false,complete:false,loaded:0};
    originals=new Map(results.filter(result=>result.status==='fulfilled').map(result=>result.value));
    return {ok:true,complete:originals.size===names.length,loaded:originals.size,version:SOURCE_VERSION};
  }
  const SIZE=16;
  const clamp=n=>Math.max(0,Math.min(255,Math.round(n)));
  function hash(x,y,seed){let n=Math.imul(x+17,374761393)^Math.imul(y+29,668265263)^Math.imul(seed+31,1274126177);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;}
  function image(){return {width:SIZE,height:SIZE,pixels:new Uint8ClampedArray(SIZE*SIZE*4)};}
  function pixel(out,x,y,color){
    if(x<0||y<0||x>=SIZE||y>=SIZE)return;
    const index=(y*SIZE+x)*4;out.pixels[index]=clamp(color[0]);out.pixels[index+1]=clamp(color[1]);out.pixels[index+2]=clamp(color[2]);out.pixels[index+3]=color[3]??255;
  }
  const bases={stone:[131,132,131],soil:[139,105,75],granite:[164,113,96],diorite:[205,204,196],andesite:[137,139,136],moss:[119,126,108],obsidian:[29,22,43],magma:[86,51,45],bedrock:[68,68,67]};
  const ores={coal:[32,31,30],iron:[196,166,135],gold:[239,209,44],redstone:[219,24,18],lapis:[35,70,201],emerald:[31,210,58],diamond:[56,220,216],crystal:[56,220,216],copper:[195,118,68]};
  function tile(kind,variant=0){
    const out=image(),base=bases[kind]||bases.stone;
    for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
      const coarse=(hash(Math.floor(x/3),Math.floor(y/2),variant+7)-.5)*36;
      const fine=(hash(x,y,variant+11)-.5)*(kind==='bedrock'?150:kind==='diorite'?60:27);
      let offset=coarse+fine;
      if(kind==='obsidian')offset=(hash(Math.floor(x/2),Math.floor(y/3),variant+37)-.5)*35;
      let color=base.map(c=>c+offset);
      if(kind==='moss'&&hash(Math.floor(x/3),Math.floor(y/3),variant+43)>.57)color=[87+offset,111+offset,50+offset];
      if(kind==='magma'&&hash(Math.floor(x/3),Math.floor(y/3),variant+61)>.69)color=[206+offset,97+offset,22+offset];
      if(kind==='bedrock'&&hash(x,y,variant+97)>.74)color=[167+coarse,167+coarse,163+coarse];
      pixel(out,x,y,color);
    }
    if(ores[kind]){
      const clusters=[[3,3],[10,2],[12,9],[5,11],[8,7],[2,8]];
      for(let i=0;i<clusters.length;i++){
        const [cx,cy]=clusters[(i+variant)%clusters.length];
        const ore=kind==='copper'&&i%2===0?[74,153,130]:ores[kind];
        for(const [dx,dy] of [[0,0],[1,0],[-1,1],[0,1],[1,1],[0,2]]){
          const light=dy===0?43:dx===-1?-45:dy===2?-34:0;
          pixel(out,cx+dx,cy+dy,ore.map(c=>c+light));
        }
      }
    }
    return out;
  }
  function inside(x,y,points){let contained=false;for(let i=0,j=points.length-1;i<points.length;j=i++){
    const [ax,ay]=points[i],[bx,by]=points[j];if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)contained=!contained;
  }return contained;}
  function pickaxe(kind){
    const out=image(),mask=new Map();
    const colors={wood:[172,123,64],stone:[169,174,168],gold:[246,211,38],diamond:[50,211,199],netherite:[100,78,110]};
    const color=colors[kind]||colors.wood;
    for(let i=0;i<10;i++)mask.set(`${3+i},${14-i}`,[i%2?121:163,i%2?78:111,i%2?35:56]);
    const shape=[[2,3],[5,1],[9,1],[14,6],[14,10],[12,9],[10,6],[7,4],[3,5]];
    for(let y=0;y<11;y++)for(let x=0;x<SIZE;x++)if(inside(x+.5,y+.5,shape))mask.set(`${x},${y}`,color.map(c=>c+(y<3?30:x>11?-40:0)));
    for(const key of mask.keys()){
      const [x,y]=key.split(',').map(Number);
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])if(!mask.has(`${x+dx},${y+dy}`))pixel(out,x+dx,y+dy,[26,23,17]);
    }
    for(const [key,rgb] of mask){const [x,y]=key.split(',').map(Number);pixel(out,x,y,rgb);}
    return out;
  }
  function tnt(kind='tnt'){
    const out=image();
    const base=kind==='jackpot'?[37,126,211]:kind==='nuke'?[61,133,71]:kind==='mega'?[186,114,33]:[203,43,30];
    for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
      let color=base.map(c=>c+(x%4===0?-38:x%4===1?12:0)+(y===0?30:0));
      if(kind==='jackpot'&&(Math.floor(x/4)+Math.floor(y/4))%2)color=[246,192,40];
      if(y>=6&&y<=10)color=[239,238,215];
      if(y===5||y===11)color=[85,67,49];
      pixel(out,x,y,color);
    }
    const letters=['11101010111','01001110010','01001010010','01001010010','01001010010'];
    for(let y=0;y<5;y++)for(let x=0;x<11;x++)if(letters[y][x]==='1')pixel(out,x+2,y+6,[22,23,23]);
    return out;
  }
  function sprite(kind){
    const out=image();
    function rect(x,y,w,h,color){for(let row=y;row<y+h;row++)for(let col=x;col<x+w;col++)pixel(out,col,row,color);}
    if(kind==='creeper'){
      rect(4,0,8,7,[74,151,49]);rect(5,7,6,6,[87,161,56]);rect(3,13,4,3,[61,118,40]);rect(9,13,4,3,[61,118,40]);
      rect(5,2,2,2,[18,33,16]);rect(9,2,2,2,[18,33,16]);rect(7,4,2,3,[18,33,16]);rect(6,5,4,1,[18,33,16]);
    }else if(kind==='arrow'){
      for(let i=2;i<14;i++)rect(i,15-i,1,2,[135,96,48]);rect(11,1,4,2,[216,219,213]);rect(13,1,2,4,[216,219,213]);rect(1,11,3,3,[231,229,203]);
    }else if(kind==='fire'){
      for(let y=3;y<16;y++)for(let x=2;x<14;x++)if(y>5+(x*7%5))pixel(out,x,y,y>11?[255,221,69]:[239,107+(x%3)*20,24]);
    }else{
      const colors=kind==='ice'?[[151,201,242],[196,231,252]]:kind==='dispenser'?[[109,111,110],[59,61,62]]:[[38,100,202],[71,145,229]];
      for(let y=0;y<16;y++)for(let x=0;x<16;x++)pixel(out,x,y,colors[(Math.floor(x/3)+Math.floor(y/2))%2]);
      if(kind==='dispenser')rect(5,5,6,6,[23,25,26]);
    }
    return out;
  }
  return {tile,pickaxe,tnt,sprite,source,loadOriginals,ORIGINAL_NAMES,EFFECT_NAMES,SOURCE_VERSION};
});
