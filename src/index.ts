import mariadb from "mariadb";
import {performance} from "perf_hooks";

export interface Connection extends mariadb.PoolConnection {
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
    insert<T extends string>(
        table: T,
        params: Record<string, any>| Array<Record<string, any>>,
        options?: {
            replace?: boolean,
            into?: boolean,
            duplicate?: Array<string>|boolean,
            returning?: Array<string>|boolean,
            ignore?: boolean,
            chunk?: number,
            pause?:number
        }
    ):Promise<mariadb.UpsertResult|Array<mariadb.UpsertResult>>,
    update<T extends string>(
        table: T,
        where: string,
        params: Record<string, any>,
        options?: {
            ignore?: boolean,
            exclude?:Array<string> // Exclude keys - used for placeholders
        }
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

    createPoolCluster(config: mariadb.PoolClusterConfig): mariadb.PoolCluster {
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

    async poolQuery<T extends any = QueryResult>(sql: string| mariadb.QueryOptions, values?: any) {
        if(typeof this._buildmsqlPool === "undefined") {
            throw Error("pool is undefined");
        }
        sql = typeof sql === "string" ? {sql, isPool: true} : Object.assign(sql, {isPool: true});

        return await this.query<T>(sql, values);
    }

    async poolQueryStream(sql: string| mariadb.QueryOptions, values?: any) {
        if(typeof this._buildmsqlPool === "undefined") {
            throw Error("pool is undefined");
        }

        const connection = await this.getConnection();

        return this.queryStream(sql, values)
            .on("end", async() => {
                await connection.release();
            });
    }

    async poolBatch(sql: string| mariadb.QueryOptions, values?: any) {
        if(typeof this._buildmsqlPool === "undefined") {
            throw Error("pool is undefined");
        }
        sql = typeof sql === "string" ? {sql, isPool: true} : Object.assign(sql, {isPool: true});

        return await this.batch(sql, values);
    }

    async poolInsert<T extends string>(
        table: T,
        params: Record<string, any>| Array<Record<string, any>>,
        options?: InsertOptions
    ) {
        if(typeof this._buildmsqlPool === "undefined") {
            throw Error("pool is undefined");
        }

        return await this.insert(table, params, Object.assign(options || {}, {isPool: true}));
    }

    async poolUpdate<T extends string>(
        table: T,
        where: string,
        params: Record<string, any>,
        options?: {
            ignore?: boolean,
            exclude?:Array<string>
        }
    ) {
        if(typeof this._buildmsqlPool === "undefined") {
            throw Error("pool is undefined");
        }

        return await this.update(table, where, params, Object.assign(options || {}, {isPool: true}));
    }

    async clusterQuery<T extends any = QueryResult>(sql: string| mariadb.QueryOptions, values?: any) {
        if(typeof this._buildmsqlCluster === "undefined") {
            throw Error("cluster is undefined");
        }

        const connection = await this.getConnectionCluster();
        try {
            return await this.query<T>(sql, values);
        } catch(e) {
            throw e;
        } finally {
            await connection.release();
        }
    }

    async clusterQueryStream(sql: string| mariadb.QueryOptions, values?: any) {
        if(typeof this._buildmsqlCluster === "undefined") {
            throw Error("cluster is undefined");
        }

        const connection = await this.getConnectionCluster();

        return this.queryStream(sql, values)
            .on("end", async() => {
                await connection.release();
            });
    }

    async clusterBatch(sql: string| mariadb.QueryOptions, values?: any) {
        if(typeof this._buildmsqlCluster === "undefined") {
            throw Error("cluster is undefined");
        }

        const connection = await this.getConnectionCluster();
        try {
            return await this.batch(sql, values);
        } catch(e) {
            throw e;
        } finally {
            await connection.release();
        }
    }

    async clusterInsert<T extends string>(
        table: T,
        params: Record<string, any>| Array<Record<string, any>>,
        options?: InsertOptions
    ) {
        if(typeof this._buildmsqlCluster === "undefined") {
            throw Error("cluster is undefined");
        }

        const connection = await this.getConnectionCluster();
        try {
            return await this.insert(table, params, options);
        } catch(e) {
            throw e;
        } finally {
            await connection.release();
        }
    }

    async clusterUpdate<T extends string>(
        table: T,
        where: string,
        params: Record<string, any>,
        options?: {
            ignore?: boolean
        }
    ) {
        if(typeof this._buildmsqlCluster === "undefined") {
            throw Error("cluster is undefined");
        }

        const connection = await this.getConnectionCluster();
        try {

            return await this.update(table, where, params, options);
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

    async query<T extends any = QueryResult>(
        sql: string| QueryOptions, values?: any
    ): Promise<T> {
        try {
            this._debugStart(sql, values);
            const provider = typeof sql === "string"
                ? this._buildmsqlConnection
                : (sql.isPool ? this._buildmsqlPool : this._buildmsqlConnection);

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

    queryStream(sql: string| QueryOptions, values?: any) {
        this._debugStart(sql, values);

        return this._buildmsqlConnection.queryStream(sql, values)
            .on("error", async() => {
                this._debugEnd();

            })
            .on("fields", meta => {
                this._buildmsqlMeta = meta;
            })
            .on("end", async() => {
                this._debugEnd();
            });
    }

    async batch(sql: string| QueryOptions, values?: any) {
        try {
            this._debugStart(sql, values);
            const provider = typeof sql === "string"
                ? this._buildmsqlConnection
                : (sql.isPool ? this._buildmsqlPool : this._buildmsqlConnection);

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

    lastInsertId(): number|bigint {
        const meta = this._buildmsqlMeta as mariadb.UpsertResult;

        return meta.insertId;
    }

    affectedRows(): number {
        const meta = this._buildmsqlMeta as mariadb.UpsertResult;

        return meta.affectedRows;
    }

    warningStatus(): number {
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

    async insert<T extends string>(
        table: T,
        params: Record<string, any>| Array<Record<string, any>>,
        options?: InsertOptions
    ):Promise<mariadb.UpsertResult|Array<mariadb.UpsertResult>> {
        const isArray = Array.isArray(params);
        options= options || {};
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
        const duplicate = Array.isArray(options.duplicate) && options.duplicate.length && !options.replace
            ? `ON DUPLICATE KEY UPDATE ${options.duplicate.map(v => `${v}=VALUES(${v})`).join(", ")}`
            : "";
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

            if(isArray) {
                result = await this.batch({
                    sql,
                    namedPlaceholders: true,
                    isPool: options.isPool
                }, chunk);
            } else {
                result = await this.query({
                    sql,
                    namedPlaceholders: true,
                    isPool: options.isPool
                }, chunk);
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

    async update<T extends string>(
        table: T,
        where: string,
        params: Record<string, any>,
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