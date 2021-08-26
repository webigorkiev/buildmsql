(()=>{"use strict";var t={607:function(t,i,e){var s=this&&this.__importDefault||function(t){return t&&t.__esModule?t:{default:t}};Object.defineProperty(i,"__esModule",{value:!0}),i.Query=void 0;const r=s(e(108)),o=e(630);i.Query=class{constructor(t={}){this._buildmsqlQueries=[],this._buildmsqlOptions=t}async createConnection(t){return this.proxy(await r.default.createConnection(t))}createPool(t){return this._buildmsqlPool=r.default.createPool(t),this._buildmsqlPool}createPoolCluster(t){return this._buildmsqlCluster=r.default.createPoolCluster(t),this._buildmsqlCluster}getPool(){if(void 0===this._buildmsqlPool)throw Error("pool is undefined");return this._buildmsqlPool}getCluster(){if(void 0===this._buildmsqlCluster)throw Error("cluster is undefined");return this._buildmsqlCluster}async getConnection(){if(void 0===this._buildmsqlPool)throw Error("pool is undefined");return this.proxy(await this._buildmsqlPool.getConnection())}async getConnectionCluster(t,i){if(void 0===this._buildmsqlCluster)throw Error("cluster is undefined");return i=(t=t||this._buildmsqlOptions.pattern)||this._buildmsqlOptions.selector,this.proxy(await this._buildmsqlCluster.getConnection(t,i))}async poolQuery(t,i){if(void 0===this._buildmsqlPool)throw Error("pool is undefined");return t="string"==typeof t?{sql:t,isPool:!0}:Object.assign(t,{isPool:!0}),await this.query(t,i)}async poolQueryStream(t,i){if(void 0===this._buildmsqlPool)throw Error("pool is undefined");const e=await this.getConnection();return this.queryStream(t,i).on("end",(async()=>{await e.release()}))}async poolBatch(t,i){if(void 0===this._buildmsqlPool)throw Error("pool is undefined");return t="string"==typeof t?{sql:t,isPool:!0}:Object.assign(t,{isPool:!0}),await this.batch(t,i)}async poolInsert(t,i,e){if(void 0===this._buildmsqlPool)throw Error("pool is undefined");return await this.insert(t,i,Object.assign(e||{},{isPool:!0}))}async poolUpdate(t,i,e,s){if(void 0===this._buildmsqlPool)throw Error("pool is undefined");return await this.update(t,i,e,Object.assign(s||{},{isPool:!0}))}async clusterQuery(t,i){if(void 0===this._buildmsqlCluster)throw Error("pool is undefined");const e=await this.getConnectionCluster();try{return await this.query(t,i)}catch(t){throw t}finally{await e.release()}}async clusterQueryStream(t,i){if(void 0===this._buildmsqlCluster)throw Error("pool is undefined");const e=await this.getConnectionCluster();return this.queryStream(t,i).on("end",(async()=>{await e.release()}))}async clusterBatch(t,i){if(void 0===this._buildmsqlCluster)throw Error("pool is undefined");const e=await this.getConnectionCluster();try{return await this.batch(t,i)}catch(t){throw t}finally{await e.release()}}async clusterInsert(t,i,e){if(void 0===this._buildmsqlCluster)throw Error("pool is undefined");const s=await this.getConnectionCluster();try{return await this.insert(t,i,e)}catch(t){throw t}finally{await s.release()}}async clusterUpdate(t,i,e,s){if(void 0===this._buildmsqlCluster)throw Error("pool is undefined");const r=await this.getConnectionCluster();try{return await this.update(t,i,e,s)}catch(t){throw t}finally{await r.release()}}_setConnection(t){this._buildmsqlConnection=t}proxy(t){return this._setConnection(t),new Proxy(t,{get:(t,i,e)=>Reflect.has(this,i)||"string"==typeof i&&0===i.indexOf("_buildmsql")?Reflect.get(this,i,e):Reflect.get(t,i,e),set:(t,i,e,s)=>Reflect.has(this,i)||"string"==typeof i&&0===i.indexOf("_buildmsql")?Reflect.set(this,i,e):Reflect.set(t,i,e)})}async query(t,i){try{this._debugStart(t,i);const e="string"==typeof t?this._buildmsqlConnection:t.isPool?this._buildmsqlPool:this._buildmsqlConnection;if(!e)throw Error("provider for query is empty");const s=await e.query(t,i),r=s.hasOwnProperty("meta")?s.meta:s;return this._buildmsqlMeta=r,s}catch(t){throw t}finally{this._debugEnd()}}queryStream(t,i){return this._debugStart(t,i),this._buildmsqlConnection.queryStream(t,i).on("error",(async()=>{this._debugEnd()})).on("fields",(t=>{this._buildmsqlMeta=t})).on("end",(async()=>{this._debugEnd()}))}async batch(t,i){try{this._debugStart(t,i);const e="string"==typeof t?this._buildmsqlConnection:t.isPool?this._buildmsqlPool:this._buildmsqlConnection;if(!e)throw Error("provider for query is empty");const s=await e.batch(t,i);return this._buildmsqlMeta=s,s}catch(t){throw t}finally{this._debugEnd()}}async beginTransaction(){this._buildmsqlOptions.nativeTransactions?await this.query("\nSTART TRANSACTION"):await this._buildmsqlConnection.beginTransaction()}async rollback(){this._buildmsqlOptions.nativeTransactions?await this.query("\nROLLBACK"):await this._buildmsqlConnection.rollback()}async commit(){this._buildmsqlOptions.nativeTransactions?await this.query("\nCOMMIT"):await this._buildmsqlConnection.commit()}getMeta(){return this._buildmsqlMeta}lastInsertId(){return this._buildmsqlMeta.insertId}affectedRows(){return this._buildmsqlMeta.affectedRows}warningStatus(){return this._buildmsqlMeta.warningStatus}quote(t){if(this._buildmsqlConnection)return this._buildmsqlConnection.escape(t);if(this._buildmsqlPool)return this._buildmsqlPool.escape(t);throw Error("connection and pool is undefined")}async insert(t,i,e){const s=Array.isArray(i);(e=e||{}).returning=!0===e.returning?Object.keys(s?i[0]:i):e.returning,e.duplicate=!0===e.duplicate?Object.keys(s?i[0]:i):e.duplicate,e.chunk=e.chunk||(s?i.length:1);const r=e.replace?"REPLACE":"INSERT",o=e.ignore&&!e.replace?"IGNORE":"",n=Array.isArray(e.returning)&&e.returning.length?`RETURNING ${e.returning.join(", ")}`:"",l=Array.isArray(e.duplicate)&&e.duplicate.length&&!e.replace?`ON DUPLICATE KEY UPDATE ${e.duplicate.map((t=>`${t}=VALUES(${t})`)).join(", ")}`:"",a=`\n            ${r} ${o} ${t} (${s?Object.keys(i[0]).join(", "):Object.keys(i).join(", ")}) \n            VALUES (${s?Object.keys(i[0]).map((t=>`:${t}`)).join(", "):Object.keys(i).map((t=>`:${t}`)).join(", ")}) \n            ${l} \n            ${n};\n        `,u=e.chunk;let d;for(let r=0,o=s?i.length:1;r<o;r+=u){const o=s?i.slice(r,r+u):i;d=s?await this.batch({sql:a,namedPlaceholders:!0,isPool:e.isPool},o):await this.query({sql:a,namedPlaceholders:!0,isPool:e.isPool},o),e.isPool?this._buildmsqlPool&&this._buildmsqlPool.emit("inserted",t,d):this._buildmsqlConnection.emit("inserted",t,d)}return d}async update(t,i,e,s){s=s||{};const r=Object.keys(e).map((t=>`${t} = :${t}`)).join(", "),o=`UPDATE ${s.ignore?"IGNORE":""} ${t} SET ${r} WHERE ${i};`,n=await this.query({sql:o,namedPlaceholders:!0,isPool:s.isPool},e);return s.isPool?this._buildmsqlPool&&this._buildmsqlPool.emit("inserted",t,n):this._buildmsqlConnection.emit("inserted",t,n),n}statistics(){return{count:this._buildmsqlQueries.length,time:Math.round(100*this._buildmsqlQueries.reduce(((t,i)=>t+i.time),0))/100,queries:this._buildmsqlQueries}}_debugStart(t,i){if(this._buildmsqlOptions.debug){let e="object"==typeof t?t.sql:t;i&&(Array.isArray(i)?i.map((t=>e=e.replace("?",this.quote(t)))):Object.keys(i).map((t=>e=e.replace(new RegExp(":"+t,"ig"),this.quote(i[t]))))),this._buildmsqlQueries.push({threadId:this._buildmsqlConnection?.threadId,start:o.performance.now(),time:0,sql:e})}}_debugEnd(){if(this._buildmsqlOptions.debug){const t=this._buildmsqlQueries.pop();t&&t.start&&(t.time=Math.round(100*(o.performance.now()-t.start))/100,delete t.start,this._buildmsqlQueries.push(t))}}}},108:t=>{t.exports=require("mariadb")},630:t=>{t.exports=require("perf_hooks")}},i={},e=function e(s){var r=i[s];if(void 0!==r)return r.exports;var o=i[s]={exports:{}};return t[s].call(o.exports,o,o.exports,e),o.exports}(607);module.exports=e})();