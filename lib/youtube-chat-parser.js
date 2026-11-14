'use strict';
const fail=code=>Object.assign(new Error(code), {
  code
});
const MAX_BYTES=262144;
function boundedShape(value) {
  let keys=0;
  const stack=[[value,0]];
  while(stack.length) {
    const [v,d]=stack.pop();
    if(d>16)throw fail('youtube_framing');
    if(v&&typeof v==='object') {
      const entries=Object.values(v);
      keys+=entries.length;
      if(keys>10000)throw fail('youtube_framing');
      for(const x of entries)stack.push([x,d+1]);
    }
  }
  return value;
}
/** Incremental Google HTTP JSON-array framing; never SSE or NDJSON. */
class JsonArrayFramer {
  constructor(emit) {
    this.emit=emit;
    this.decoder=new TextDecoder('utf-8', {
      fatal:true
    });
    this.started=false;
    this.done=false;
    this.frame='';
    this.depth=0;
    this.string=false;
    this.escape=false;
    this.count=0;
    this.needValue=true;
    this.afterComma=false;
  }
  push(bytes) {
    let text;
    try {
      text=this.decoder.decode(bytes, {
        stream:true
      });
    } catch {
      throw fail('youtube_framing');
    }
    this.consume(text);
  }
  consume(text) {
    for(const c of text) {
      if(this.done) {
        if(!/\s/.test(c))throw fail('youtube_framing');
        continue;
      }
      if(!this.started) {
        if(/\s/.test(c))continue;
        if(c==='{') {
          this.started=true;
          this.providerObject=true;
          this.depth=1;
          this.frame='{';
          this.frameBytes=1;
          continue;
        }
        if(c!=='[')throw fail('youtube_framing');
        this.started=true;
        continue;
      }
      if(!this.depth) {
        if(/\s/.test(c))continue;
        if(c===']'&&!this.afterComma) {
          this.done=true;
          continue;
        }
        if(c===','&&!this.needValue) {
          this.needValue=true;
          this.afterComma=true;
          continue;
        }
        if(c!=='{'||!this.needValue)throw fail('youtube_framing');
        this.depth=1;
        this.frame='{';
        this.frameBytes=1;
        this.needValue=false;
        this.afterComma=false;
        continue;
      }
      this.frame+=c;
      this.frameBytes+=Buffer.byteLength(c);
      if(this.frameBytes>MAX_BYTES)throw fail('youtube_framing');
      if(this.string) {
        if(this.escape)this.escape=false;
        else if(c==='\\')this.escape=true;
        else if(c==='"')this.string=false;
      } else if(c==='"')this.string=true;
      else if(c==='{'||c==='[') {
        if(++this.depth>16)throw fail('youtube_framing');
      } else if(c==='}'||c===']') {
        if(--this.depth===0) {
          let value;
          try {
            value=boundedShape(JSON.parse(this.frame));
          } catch {
            throw fail('youtube_framing');
          }
          if(++this.count>1000)throw fail('youtube_framing');
          if(value.error)throw fail(providerCode(value.error));
          if(this.providerObject)throw fail('youtube_framing');
          this.emit(value);
          this.frame='';
        }
      }
    }
  }
  end() {
    this.consume(this.decoder.decode());
    if(!this.done||this.depth)throw fail('youtube_framing');
  }
}
function providerCode(e) {
  const reasons=(e?.errors||[]).map(x=>x.reason);
  if(reasons.some(x=>/quota|dailyLimit/i.test(x)))return 'youtube_quota';
  if(reasons.includes('liveChatEnded'))return 'youtube_ended';
  if(reasons.includes('liveChatDisabled'))return 'youtube_disabled';
  if(e?.code===401||e?.code===403)return 'youtube_auth_required';
  return 'youtube_provider';
}
module.exports= {
  JsonArrayFramer,boundedShape,providerCode
};
