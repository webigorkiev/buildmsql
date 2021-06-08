import type mariadb from "mariadb";
import {performance} from "perf_hooks";

export interface Connection extends mariadb.PoolConnection {
    insertArray(): void,
    proxy(): Connection,
    getMeta(): Array<MetadataResultSet>|mariadb.UpsertResult|Array<mariadb.UpsertResult>,
    lastInsertId(): number|undefined,
    affectedRows(): number|undefined,
    warningStatus(): number|undefined,
    quote(input: any): string,
    statistics(): {
        count: number,
        time: number,
        queries: Array<QueriesInfo>
    },
    insert(
        table: string,
        params: Record<string, any>| Array<Record<string, any>>,
        options?: {
            replace?: boolean,
            duplicate?: Array<string>|boolean,
            returning?: Array<string>|boolean,
            ignore?: boolean,
            chunk?: number
        }
    ):Promise<mariadb.UpsertResult|Array<mariadb.UpsertResult>|Array<any>>,
    update(
        table: string,
        where: string,
        params: Record<string, any>,
        options?: {
            ignore?: boolean,
        }
    ): Promise<mariadb.UpsertResult>
}

interface mariadbConnection extends mariadb.PoolConnection {
    emit(eventName: string|symbol, ...args: Array<any>): boolean
}

/**
 * Options for auery builder
 */
export interface QueryOptions {

    // Debug level: 0 - no debag info, 1 - _buildmsqlQueries text and timing
    debug?: 0|1,

    // Used for manticore search
    nativeTransactions?: boolean
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

interface InsertOptions {
    replace?: boolean,
    duplicate?: Array<string>|boolean,
    returning?: Array<string>|boolean,
    ignore?: boolean,
    chunk?: number
}

/**
 * Query builder class
 */
export class Query {
    private _buildmsqlPoll: mariadb.Pool| undefined;
    private _buildmsqlConnection: mariadbConnection;
    private _buildmsqlOptions: QueryOptions;

    /**
     * array _buildmsqlQueries information for debug
     * @private
     *
     */
    private _buildmsqlQueries: Array<QueriesInfo> = [];

    /**
     * object for update/insert/delete
     * @private
     */
    private _buildmsqlMeta: Array<MetadataResultSet>|mariadb.UpsertResult|Array<mariadb.UpsertResult>

    /**
     * @constructor
     * @param options - config options for query
     * @param pool
     */
    constructor(options: QueryOptions = {}, pool?:mariadb.Pool) {
        this._buildmsqlOptions = options;
        this._buildmsqlPoll = pool;
    }

    /**
     * Query in pool instance
     * @param sql
     * @param values
     */
    async poolQuery(sql: string| mariadb.QueryOptions, values?: any) {
        if(typeof this._buildmsqlPoll === "undefined") {
            throw Error("pool is undefined");
        }

        const connection = this.proxy(await this._buildmsqlPoll.getConnection());
        try {
            return await connection.query(sql, values);
        } catch(e) {
            throw e;
        } finally {
            await connection.release();
        }
    }

    /**
     * Query in pool instance
     * @param sql sql string or object
     * @param values object of values
     */
    async poolQueryStream(sql: string| mariadb.QueryOptions, values?: any) {
        if(typeof this._buildmsqlPoll === "undefined") {
            throw Error("pool is undefined");
        }

        const connection = this.proxy(await this._buildmsqlPoll.getConnection());

        return connection.queryStream(sql, values)
            .on("end", async() => {
                await connection.release();
            });
    }

    /**
     * Query in pool instance
     * @param sql sql string or object
     * @param values object of values
     */
    async poolBatch(sql: string| mariadb.QueryOptions, values?: any) {
        if(typeof this._buildmsqlPoll === "undefined") {
            throw Error("pool is undefined");
        }

        const connection = this.proxy(await this._buildmsqlPoll.getConnection());
        try {
            return await connection.batch(sql, values);
        } catch(e) {
            throw e;
        } finally {
            await connection.release();
        }
    }

    /**
     * Insert single request and release
     * @param table name
     * @param params object of values
     * @param options
     */
    async poolInsert(
        table: string,
        params: Record<string, any>| Array<Record<string, any>>,
        options?: InsertOptions
    ) {
        if(typeof this._buildmsqlPoll === "undefined") {
            throw Error("pool is undefined");
        }

        const connection = this.proxy(await this._buildmsqlPoll.getConnection());
        try {
            return await connection.insert(table, params, options);
        } catch(e) {
            throw e;
        } finally {
            await connection.release();
        }
    }

    /**
     * Update single request and release
     * @param table name
     * @param where string of where
     * @param params object of values
     * @param options
     */
    async poolUpdate(
        table: string,
        where: string,
        params: Record<string, any>,
        options?: {
            ignore?: boolean
        }
    ) {
        if(typeof this._buildmsqlPoll === "undefined") {
            throw Error("pool is undefined");
        }

        const connection = this.proxy(await this._buildmsqlPoll.getConnection());
        try {

            return await connection.update(table, where, params, options);
        } catch(e) {
            throw e;
        } finally {
            await connection.release();
        }
    }

    /**
     * Set connection object
     * @param connection
     * @private
     */
    private _setConnection(connection: mariadb.Connection|mariadb.PoolConnection) {
        this._buildmsqlConnection = connection as mariadbConnection;
    }

    /**
     * Proxy connection
     * @param connection
     */
    public proxy(connection: mariadb.Connection|mariadb.PoolConnection): Connection  {
        this._setConnection(connection);

        return new Proxy(connection as Connection, {
            get: (target, prop, receiver) => {
                if(Reflect.has(this, prop)) {

                    return Reflect.get(this, prop, receiver);
                } else {
                    return Reflect.get(target, prop, receiver);
                }
            }
        });
    }

    /**
     * Request query
     * @param sql - string sql query
     * @param values - object values for prepared _buildmsqlQueries
     * @returns result set of query
     */
    async query(sql: string| mariadb.QueryOptions, values?: any) {
        try {
            this._debugStart(sql, values);
            const result = await this._buildmsqlConnection.query(sql, values);
            this._buildmsqlMeta = result.hasOwnProperty("meta")
                ? result.meta
                : result;

            return result;
        } catch(e) {

            throw e;
        } finally {
            this._debugEnd();
        }
    }

    /**
     * Request query streem
     * @param sql - string sql query
     * @param values - object values for prepared _buildmsqlQueries
     * @returns result set of query
     */
    queryStream(sql: string| mariadb.QueryOptions, values?: any) {
        this._debugStart(sql, values);

        return this._buildmsqlConnection.queryStream(sql, values)
            .on("error", async() => {
                this._debugEnd();

            })
            .on("fields", meta => {
                this._buildmsqlMeta= meta;
            })
            .on("end", async() => {
                this._debugEnd();
            });
    }

    /**
     * Request query batch
     * @param sql - string sql query
     * @param values - object values for prepared _buildmsqlQueries
     * @returns result set of query
     */
    async batch(sql: string| mariadb.QueryOptions, values?: any) {
        try {
            this._debugStart(sql, values);
            const result = await this._buildmsqlConnection.batch(sql, values);
            this._buildmsqlMeta = result;

            return result;
        } catch(e) {

            throw e;
        } finally {
            this._debugEnd();
        }
    }

    /**
     * Begin transaction
     * @returns void
     */
    async beginTransaction(): Promise<void> {

        if(this._buildmsqlOptions.nativeTransactions) {
            await this.query("\nSTART TRANSACTION");
        } else {
            await this._buildmsqlConnection.beginTransaction();
        }
    }

    /**
     * Rollback transaction
     * @returns void
     */
    async rollback(): Promise<void> {

        if(this._buildmsqlOptions.nativeTransactions) {
            await this.query("\nROLLBACK");
        } else {
            await this._buildmsqlConnection.rollback();
        }
    }

    /**
     * Commit transaction
     * @returns void
     */
    async commit(): Promise<void> {

        if(this._buildmsqlOptions.nativeTransactions) {
            await this.query("\nCOMMIT");
        } else {
            await this._buildmsqlConnection.commit();
        }
    }

    /**
     * Get last metadata
     */
    getMeta(): Array<MetadataResultSet>|mariadb.UpsertResult|Array<mariadb.UpsertResult> {

        return this._buildmsqlMeta;
    }

    /**
     * Get last insert id
     */
    lastInsertId(): number|undefined {

        return !Array.isArray(this._buildmsqlMeta) ? this._buildmsqlMeta.insertId : undefined;
    }

    /**
     * Get affected Row
     */
    affectedRows(): number|undefined {

        return !Array.isArray(this._buildmsqlMeta) ? this._buildmsqlMeta.affectedRows : undefined;
    }

    /**
     * Get warring status
     */
    warningStatus(): number|undefined {

        return !Array.isArray(this._buildmsqlMeta) ? this._buildmsqlMeta.warningStatus : undefined;
    }

    /**
     * escape input values
     * @param input
     */
    quote(input: any): string {

        return this._buildmsqlConnection.escape(input);
    }

    /**
     * Insert|Replace [RETURNING]
     * @param table
     * @param params
     * @param options
     */
    async insert(
        table: string,
        params: Record<string, any>| Array<Record<string, any>>,
        options?: InsertOptions
    ):Promise<mariadb.UpsertResult|Array<mariadb.UpsertResult>|Array<any>> {
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
            ${command} ${ignore} ${table} (${cols}) 
            VALUES (${values}) 
            ${duplicate} 
            ${returning};
        `;
        const chunkLength: number = options.chunk as number;
        const length = isArray ? params.length : 1;
        let result;

        for(let i = 0,j = length; i < j; i += chunkLength) {
            const chunk = isArray ? params.slice(i, i + chunkLength) : params;

            if(chunkLength > 1) {
                result = await this.batch({
                    sql,
                    namedPlaceholders: true
                }, chunk);
            } else {
                result = await this.query({
                    sql,
                    namedPlaceholders: true
                }, chunk);
            }
            this._buildmsqlConnection.emit("inserted", table, result);
        }

        return result;
    }

    /**
     * Update data in table
     * @param table table name
     * @param where string for where clouse
     * @param params object input values
     * @param options
     */
    async update(
        table: string,
        where: string,
        params: Record<string, any>,
        options?: {
            ignore?: boolean
        }
    ): Promise<mariadb.UpsertResult> {
        options = options || {};
        const cols = Object.keys(params).map(v => `${v} = :${v}`).join(", ");
        const ignore = options.ignore ? "IGNORE" : "";
        const sql = `UPDATE ${ignore} ${table} SET ${cols} WHERE ${where};`;
        const result = await this.query({
            sql,
            namedPlaceholders: true
        }, params);
        this._buildmsqlConnection.emit("updated", table, result);

        return result;
    }

    /**
     * Get query statistics
     * @returns _buildmsqlQueries statistics
     */
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

    /**
     * Start add debug info
     * @param sql - sql text
     * @param values - prepared values object or array
     */
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
                threadId: this._buildmsqlConnection.threadId,
                start: performance.now(),
                time: 0,
                sql: sqlString
            });
        }
    }

    /**
     * End add debug info
     */
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