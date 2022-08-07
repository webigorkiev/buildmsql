import mariadb from "mariadb";
import {performance} from "perf_hooks";
import * as util from "util";
import {Readable, Writable} from "stream";

export interface Connection extends mariadb.PoolConnection {
    createStreamQueryInterface(opt: StreamInterfaceOptions): Readable,
    proxy(): Connection,
    getMeta(): Array<MetadataResultSet>|mariadb.UpsertResult|Array<mariadb.UpsertResult>,
    lastInsertId(): number,
    affectedRows(): number,
    warningStatus(): number,
    quote(input: any): string,
    statistics(): {
        count: number,
        time: number,
        queries: Array<QueriesInfo>
    },
    query<T extends any = QueryResult, V = Record<string, any>>(sql: string| QueryOptions, values?: Partial<V>): Promise<T>,
    insert<T extends string, V = Record<string, any>>(
        table: T,
        params: Partial<V>| Partial<V>[],
        options?: InsertOptions
    ):Promise<mariadb.UpsertResult|Array<mariadb.UpsertResult>>,
    update<T extends string, V = Record<string, any>>(
        table: T,
        where: string,
        params: Partial<V>,
        options?: UpdateOptions
    ): Promise<mariadb.UpsertResult>,
    getPool(): mariadb.Pool|mariadb.PoolCluster
}
export interface QueryOptions extends mariadb.QueryOptions {
    isPool?: boolean
}
export interface mariadbConnection extends mariadb.PoolConnection {
    emit(eventName: string|symbol, ...args: Array<any>): boolean
}
export interface mariadbPool extends mariadb.Pool {
    emit(eventName: string|symbol, ...args: Array<any>): boolean
}

/**
 * Options for query builder
 */
export interface Options {

    // Debug level: 0 - no debag info, 1 - _buildmsqlQueries text and timing
    debug?: 0|1,

    // Used for manticore search
    nativeTransactions?: boolean,

    // Used for manticore search multi insert
    suppressBulk?: boolean,

    // pattern *string* regex pattern to select pools. Example, `"slave*"`. default `'*'`
    pattern?:string,

    // *string* pools selector. Can be 'RR' (round-robin),
    // 'RANDOM' or 'ORDER' (use in sequence = always use first pools unless fails)
    selector?: "RR"|"RANDOM"|"ORDER"
}

/**
 * Metadata of result set
 */
export interface MetadataResultSet {
    collation: {
        index: number,
        name: string,
        encoding: string,
        maxlen: number
    },
    columnLength: number,
    columnType: number,
    scale: number,
    type: mariadb.Types,
    flags: number,
    db: CallableFunction,
    schema: CallableFunction,
    table: CallableFunction,
    orgTable: CallableFunction,
    name: CallableFunction,
    orgName: CallableFunction
}

export interface QueriesInfo {
    start?: number,
    threadId: number| null,
    time: number,
    sql: string
}

export interface InsertOptions {
    replace?: boolean,
    into?:boolean,
    duplicate?: Array<string>|boolean,
    returning?: Array<string>|boolean,
    ignore?: boolean,
    chunk?: number,
    isPool?: boolean,
    pause?:number,
    suppressBulk?:boolean,
    last_insert_id?: string, // field for ON DUPLICATE UPDATE id = LAST_INSERT_ID(id)
    handler?:(result: mariadb.UpsertResult[]) => void // handler for bath results
}
export interface UpdateOptions {
    ignore?: boolean,
    isPool?: boolean,
    exclude?:Array<string>, // Exclude keys - used for placeholders
}
export interface QueryResult extends Array<Record<string, any>> {
    meta: MetadataResultSet,
    [key: number]: Record<string, any>
}
export type {mariadb as mariadb};

export interface StreamInterfaceOptions {
    input: Readable,
    output?:Readable,
    chunk?: number,
    highWaterMark?:number
}

/**
 * Query builder class
 */
export class Query {
    private _buildmsqlCluster?:mariadb.PoolCluster;
    private _buildmsqlPool?: mariadbPool;
    private _buildmsqlConnection: mariadbConnection;
    private _buildmsqlOptions: Options;

    /**
     * array _buildmsqlQueries information for debug
     */
    private _buildmsqlQueries: Array<QueriesInfo> = [];

    /**
     * object for update/insert/delete
     */
    private _buildmsqlMeta: Array<MetadataResultSet>|mariadb.UpsertResult|Array<mariadb.UpsertResult>;

    // Create interface for sync by chunk
    public createStreamQueryInterface(opt: StreamInterfaceOptions): Readable {
        const chunk = opt.chunk || 1000;
        let i = 0;
        const output = opt.output || new Readable({
            objectMode: true,
            highWaterMark: 1,
            read(size: number) {}
        });
        output.pause();
        const write = new Writable({
            highWaterMark: opt.highWaterMark || chunk + 1,
            objectMode: true,
            writev(
                chunks: Array<{ chunk: any; encoding: BufferEncoding }>, callback: (error?: (Error | null)
            ) => void) {
                output.push(chunks.map((row) => row.chunk));
                callback(null);
            },
            final(callback: (error?: (Error | null)) => void) {
                output.push(null);
                callback(null);
            }
        });
        write.cork();
        opt.input
            .on("data", () => {
                if(i >= chunk) {
                    i = 0;
                    write.uncork();
                    write.cork();
                }
                i++;
            })
            .on("end", () => {
                write.uncork();
                write.end();
            })
            .pipe(write);

        return output;
    }

    constructor(options: Options = {}) {
        this._buildmsqlOptions = options;
    }

    async createConnection(config: mariadb.ConnectionConfig): Promise<Connection> {

        return this.proxy(await mariadb.createConnection(config));
    }

    createPool(config: mariadb.PoolConfig): mariadbPool {
        this._buildmsqlPool = mariadb.createPool(config) as mariadbPool;

        return this._buildmsqlPool;
    }

    createPoolCluster(config?: mariadb.PoolClusterConfig): mariadb.PoolCluster {
        this._buildmsqlCluster = mariadb.createPoolCluster(config);

        return this._buildmsqlCluster;
    }

    getPool(): mariadbPool {
        if(typeof this._buildmsqlPool === "undefined") {
            throw Error("pool is undefined");
        }

        return this._buildmsqlPool;
    }

    getCluster(): mariadb.PoolCluster {
        if(typeof this._buildmsqlCluster === "undefined") {
            throw Error("cluster is undefined");
        }

        return this._buildmsqlCluster;
    }

    async getConnection(): Promise<Connection> {
        if(typeof this._buildmsqlPool === "undefined") {
            throw Error("pool is undefined");
        }

        return this.proxy(await this._buildmsqlPool.getConnection());
    }

    async getConnectionCluster(pattern?: string, selector?: string): Promise<Connection> {
        if(typeof this._buildmsqlCluster === "undefined") {
            throw Error("cluster is undefined");
        }

        pattern  = pattern || this._buildmsqlOptions.pattern;
        selector  = pattern || this._buildmsqlOptions.selector;

        return this.proxy(await this._buildmsqlCluster.getConnection(pattern, selector));
    }

    async poolQuery<T extends any = QueryResult, V = Record<string, any>>(sql: string| mariadb.QueryOptions, values?: Partial<V>) {
        if(typeof this._buildmsqlPool === "undefined") {
            throw Error("pool is undefined");
        }

        return this.query<T>(sql, values);
    }

    async poolQueryStream<V = Record<string, any>>(sql: string| mariadb.QueryOptions, values?: Partial<V>) {
        if(typeof this._buildmsqlPool === "undefined") {
            throw Error("pool is undefined");
        }

        return this.queryStream(sql, values);
    }

    async poolBatch<V = Record<string, any>>(sql: string| mariadb.QueryOptions, values?: Partial<V>) {
        if(typeof this._buildmsqlPool === "undefined") {
            throw Error("pool is undefined");
        }

        return this.batch(sql, values);
    }

    async poolInsert<T extends string, V = Record<string, any>>(
        table: T,
        params: Partial<V>|Partial<V>[],
        options?: InsertOptions
    ) {
        if(typeof this._buildmsqlPool === "undefined") {
            throw Error("pool is undefined");
        }

        return this.insert(table, params, options || {});
    }

    async poolUpdate<T extends string, V = Record<string, any>>(
        table: T,
        where: string,
        params: Partial<V>,
        options?: {
            ignore?: boolean,
            exclude?:Array<string>
        }
    ) {
        if(typeof this._buildmsqlPool === "undefined") {
            throw Error("pool is undefined");
        }

        return this.update(table, where, params, options || {});
    }

    async clusterQuery<T extends any = QueryResult, V = Record<string, any>>(sql: string| mariadb.QueryOptions, values?: Partial<V>) {
        if(typeof this._buildmsqlCluster === "undefined") {
            throw Error("cluster is undefined");
        }

        const connection = await this.getConnectionCluster();
        try {
            return connection.query<T>(sql, values);
        } catch(e) {
            throw e;
        } finally {
            await connection.release();
        }
    }

    async clusterQueryStream<V = Record<string, any>>(sql: string| mariadb.QueryOptions, values?: Partial<V>) {
        if(typeof this._buildmsqlCluster === "undefined") {
            throw Error("cluster is undefined");
        }

        return this.queryStream(sql, values);
    }

    async clusterBatch<V = Record<string, any>>(sql: string| mariadb.QueryOptions, values?: Partial<V>) {
        if(typeof this._buildmsqlCluster === "undefined") {
            throw Error("cluster is undefined");
        }

        const connection = await this.getConnectionCluster();
        try {
            return connection.batch(sql, values);
        } catch(e) {
            throw e;
        } finally {
            await connection.release();
        }
    }

    async clusterInsert<T extends string, V = Record<string, any>>(
        table: T,
        params: Partial<V>|Partial<V>[],
        options?: InsertOptions
    ) {
        if(typeof this._buildmsqlCluster === "undefined") {
            throw Error("cluster is undefined");
        }

        const connection = await this.getConnectionCluster();
        try {
            return connection.insert(table, params, options);
        } catch(e) {
            throw e;
        } finally {
            await connection.release();
        }
    }

    async clusterUpdate<T extends string, V = Record<string, any>>(
        table: T,
        where: string,
        params: Partial<V>,
        options?: {
            ignore?: boolean
        }
    ) {
        if(typeof this._buildmsqlCluster === "undefined") {
            throw Error("cluster is undefined");
        }

        const connection = await this.getConnectionCluster();
        try {
            return  connection.update(table, where, params, options);
        } catch(e) {
            throw e;
        } finally {
            await connection.release();
        }
    }

    private _setConnection(connection: mariadb.Connection|mariadb.PoolConnection) {
        this._buildmsqlConnection = connection as mariadbConnection;
    }

    private proxy(connection: mariadb.Connection|mariadb.PoolConnection): Connection  {
        this._setConnection(connection);

        return new Proxy(connection as Connection, {
            get: (target, prop, receiver) => {
                if(
                    Reflect.has(this, prop)
                    || typeof prop === "string" && prop.indexOf("_buildmsql") === 0
                ) {

                    return Reflect.get(this, prop, receiver);
                } else {

                    return Reflect.get(target, prop, receiver);
                }
            },
            set: (target, prop, value, receiver) => {
                if(
                    Reflect.has(this, prop)
                    || typeof prop === "string" && prop.indexOf("_buildmsql") === 0
                ) {

                    return Reflect.set(this, prop, value);
                } else {

                    return Reflect.set(target, prop, value);
                }
            }
        });
    }

    async query<T extends any = QueryResult, V = Record<string, any>>(
        sql: string| QueryOptions, values?: Partial<V>
    ): Promise<T> {
        try {
            sql = typeof sql === "string" ? sql.trim() : Object.assign(sql, {sql: sql.sql.trim()});
            this._debugStart(sql, values);
            const isProxy = util.types.isProxy(this);
            const provider = isProxy
                ? this._buildmsqlConnection
                : this._buildmsqlPool;

            if(!provider) {
                throw Error("provider for query is empty");
            }
            const result = await provider.query(sql, values);
            const meta = (result.hasOwnProperty("meta") ? result.meta : result);
            this._buildmsqlMeta = meta;

            return result;
        } catch(e) {

            throw e;
        } finally {
            this._debugEnd();
        }
    }

    async queryStream<V = Record<string, any>>(sql: string| QueryOptions, values?: Partial<V>) {
        sql = typeof sql === "string" ? sql.trim() : Object.assign(sql, {sql: sql.sql.trim()});
        this._debugStart(sql, values);
        const isProxy = util.types.isProxy(this);

        if(isProxy) {
            return (await this._buildmsqlConnection.queryStream(sql, values))
                .on("error", async() => {
                    this._debugEnd();

                })
                .on("fields", meta => {
                    this._buildmsqlMeta = meta;
                })
                .on("end", async() => {
                    this._debugEnd();
                });
        } else {
            const connection = this._buildmsqlCluster
                ? await this.getConnectionCluster()
                : await this.getConnection();

            return (await connection.queryStream(sql, values))
                .on("error", async() => {
                    await connection.release();
                })
                .on("end", async() => {
                    await connection.release();
                });
        }
    }

    async batch<V = Record<string, any>>(sql: string| QueryOptions, values?: Partial<V>) {
        try {
            sql = typeof sql === "string" ? sql.trim() : Object.assign(sql, {sql: sql.sql.trim()});
            this._debugStart(sql, values);
            const isProxy = util.types.isProxy(this);
            const provider = isProxy
                ? this._buildmsqlConnection
                : this._buildmsqlPool;

            if(!provider) {
                throw Error("provider for query is empty");
            }

            const result = await provider.batch(sql, values);
            this._buildmsqlMeta = result;

            return result;
        } catch(e) {

            throw e;
        } finally {
            this._debugEnd();
        }
    }

    async beginTransaction(): Promise<void> {

        if(this._buildmsqlOptions.nativeTransactions) {
            await this.query("\nSTART TRANSACTION");
        } else {
            await this._buildmsqlConnection.beginTransaction();
        }
    }

    async rollback(): Promise<void> {

        if(this._buildmsqlOptions.nativeTransactions) {
            await this.query("\nROLLBACK");
        } else {
            await this._buildmsqlConnection.rollback();
        }
    }

    async commit(): Promise<void> {

        if(this._buildmsqlOptions.nativeTransactions) {
            await this.query("\nCOMMIT");
        } else {
            await this._buildmsqlConnection.commit();
        }
    }

    getMeta(): Array<MetadataResultSet>|mariadb.UpsertResult|Array<mariadb.UpsertResult> {

        return this._buildmsqlMeta;
    }

    lastInsertId() {
        const meta = this._buildmsqlMeta as mariadb.UpsertResult;

        return meta.insertId;
    }

    affectedRows() {
        const meta = this._buildmsqlMeta as mariadb.UpsertResult;

        return meta.affectedRows;
    }

    warningStatus() {
        const meta = this._buildmsqlMeta as mariadb.UpsertResult;

        return meta.warningStatus;
    }

    quote(input: any): string {

        if(this._buildmsqlConnection) {
            return this._buildmsqlConnection.escape(input);
        }

        //@ts-ignore
        if(this._buildmsqlPool) {

            return this._buildmsqlPool.escape(input);
        }

        throw Error("connection and pool is undefined");
    }

    async insert<T extends string, V = Record<string, any>>(
        table: T,
        params: Partial<V>|Partial<V>[],
        options?: InsertOptions
    ):Promise<mariadb.UpsertResult|Array<mariadb.UpsertResult>> {
        const isArray = Array.isArray(params);
        options= options || {};
        const isSuppressBulk = options.suppressBulk || this._buildmsqlOptions.suppressBulk;
        options.returning = options.returning === true
            ? Object.keys((isArray ? params[0] : params))
            : options.returning;
        options.duplicate = options.duplicate === true
            ? Object.keys((isArray ? params[0] : params))
            : options.duplicate;
        options.chunk = options.chunk || (isArray ? params.length : 1);
        const command = options.replace ? "REPLACE": "INSERT";
        const into = options.replace && !options.into ? "": "INTO";
        const ignore = options.ignore && !options.replace ? "IGNORE" : "";
        const returning = Array.isArray(options.returning) && options.returning.length
            ? `RETURNING ${options.returning.join(", ")}`
            : "";
        let duplicate = "";

        if(Array.isArray(options.duplicate) && options.duplicate.length && !options.replace) {
            if(isArray) {
                duplicate = `ON DUPLICATE KEY UPDATE ${options.duplicate.map(v => `${v}=VALUES(${v})`).join(", ")}`;
            } else {
                const valuesString = options.duplicate.map(v => {
                    if(options?.last_insert_id && options.last_insert_id === v) {
                        return `${v}=LAST_INSERT_ID(${v})`;
                    } else {
                        return `${v}=VALUES(${v})`;
                    }
                }).join(", ");
                duplicate = `ON DUPLICATE KEY UPDATE ${valuesString}`;
            }
        }

        const cols = isArray ? Object.keys(params[0]).join(", ") : Object.keys(params).join(", ");
        const values = isArray
            ? Object.keys(params[0]).map(v => `:${v}`).join(", ")
            : Object.keys(params).map(v => `:${v}`).join(", ");
        const sql = `
            ${command} ${ignore} ${into} ${table} (${cols}) 
            VALUES (${values}) 
            ${duplicate} 
            ${returning};
        `.trim();
        const chunkLength: number = options.chunk as number;
        const length = isArray ? params.length : 1;
        let result;

        for(let i = 0,j = length; i < j; i += chunkLength) {
            const chunk = isArray ? params.slice(i, i + chunkLength) : params;

            // id db not support batch
            if(isSuppressBulk) {
                const values = (chunk as Partial<V>[]).map(
                    (row: Record<string, any>) => `(${Object.values(row).map((v) => Array.isArray(v) ? "(" + this.quote(v) + ")" : this.quote(v)).join(",")})`
                );
                const sql = `
                    ${command} ${ignore} ${into} ${table} (${cols}) 
                    VALUES ${values.join(",")} 
                    ${duplicate} 
                    ${returning};
                `.trim();
                result = await this.query({
                    sql,
                    isPool: options.isPool
                });
            } else {

                if(isArray) {
                    result = await this.batch({
                        sql,
                        namedPlaceholders: true,
                        isPool: options.isPool
                    }, chunk as Partial<V>[]);
                } else {
                    result = await this.query({
                        sql,
                        namedPlaceholders: true,
                        isPool: options.isPool
                    }, chunk as Partial<V>[]);
                }
            }

            if(options.handler) {
                options.handler(result as mariadb.UpsertResult[]);
            }

            if(options.pause) {
                await new Promise(resolve => setTimeout(resolve, options?.pause as number));
            }
        }

        return result as mariadb.UpsertResult|mariadb.UpsertResult[];
    }

    async update<T extends string, V = Record<string, any>>(
        table: T,
        where: string,
        params: Partial<V>,
        options?: UpdateOptions
    ): Promise<mariadb.UpsertResult> {
        options = options || {};
        options.exclude = options.exclude || [];
        const exclude = options.exclude as Array<string>;
        const cols = Object.keys(params)
            .filter(v => !exclude.includes(v))
            .map(v => `${v} = :${v}`).join(", ");
        const ignore = options.ignore ? "IGNORE" : "";
        const sql = `UPDATE ${ignore} ${table} SET ${cols} WHERE ${where};`;
        const result = await this.query<mariadb.UpsertResult>({
            sql,
            namedPlaceholders: true,
            isPool: options.isPool
        }, params);

        return result;
    }

    statistics(): {
        count: number,
        time: number,
        queries: Array<QueriesInfo>
    } {
        const count = this._buildmsqlQueries.length;
        const time = Math.round(this._buildmsqlQueries.reduce((a, v) => a + v.time, 0)*100)/100;

        return {
            count,
            time,
            queries: this._buildmsqlQueries
        }
    }

    private _debugStart(
        sql: string| mariadb.QueryOptions,
        values: Record<string, any>|Array<any>|undefined = undefined
    ) {

        if(this._buildmsqlOptions.debug) {
            let sqlString = (typeof sql === "object" ? sql.sql : sql) as string;

            if(values) {
                if(Array.isArray(values)) {
                    values.map(v => sqlString = sqlString.replace('?', this.quote(v)));
                } else {
                    Object.keys(values).map(
                        key => sqlString = sqlString.replace(
                            new RegExp(':' + key, 'ig'),
                            this.quote(values[key])
                        )
                    );
                }
            }

            this._buildmsqlQueries.push({
                threadId: this._buildmsqlConnection?.threadId,
                start: performance.now(),
                time: 0,
                sql: sqlString
            });
        }
    }

    private _debugEnd() {

        if(this._buildmsqlOptions.debug) {
            const last = this._buildmsqlQueries.pop();

            if(last && last.start) {
                last.time = Math.round((performance.now() - last.start) * 100)/100;
                delete last.start;
                this._buildmsqlQueries.push(last);
            }
        }
    }
}