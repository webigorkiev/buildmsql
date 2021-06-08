/// <reference types="node" />
import type mariadb from "mariadb";
export interface Connection extends mariadb.PoolConnection {
    insertArray(): void;
    proxy(): Connection;
    getMeta(): Array<MetadataResultSet> | mariadb.UpsertResult | Array<mariadb.UpsertResult>;
    lastInsertId(): number | undefined;
    affectedRows(): number | undefined;
    warningStatus(): number | undefined;
    quote(input: any): string;
    statistics(): {
        count: number;
        time: number;
        queries: Array<QueriesInfo>;
    };
    insert(table: string, params: Record<string, any> | Array<Record<string, any>>, options?: {
        replace?: boolean;
        duplicate?: Array<string> | boolean;
        returning?: Array<string> | boolean;
        ignore?: boolean;
        chunk?: number;
    }): Promise<mariadb.UpsertResult | Array<mariadb.UpsertResult> | Array<any>>;
    update(table: string, where: string, params: Record<string, any>, options?: {
        ignore?: boolean;
    }): Promise<mariadb.UpsertResult>;
}
/**
 * Options for auery builder
 */
export interface QueryOptions {
    debug?: 0 | 1;
    nativeTransactions?: boolean;
}
/**
 * Metadata of result set
 */
export interface MetadataResultSet {
    collation: {
        index: number;
        name: string;
        encoding: string;
        maxlen: number;
    };
    columnLength: number;
    columnType: number;
    scale: number;
    type: mariadb.Types;
    flags: number;
    db: CallableFunction;
    schema: CallableFunction;
    table: CallableFunction;
    orgTable: CallableFunction;
    name: CallableFunction;
    orgName: CallableFunction;
}
export interface QueriesInfo {
    start?: number;
    threadId: number | null;
    time: number;
    sql: string;
}
interface InsertOptions {
    replace?: boolean;
    duplicate?: Array<string> | boolean;
    returning?: Array<string> | boolean;
    ignore?: boolean;
    chunk?: number;
}
/**
 * Query builder class
 */
export declare class Query {
    private _buildmsqlConnection;
    private _buildmsqlOptions;
    /**
     * array _buildmsqlQueries information for debug
     * @private
     *
     */
    private _buildmsqlQueries;
    /**
     * object for update/insert/delete
     * @private
     */
    private _buildmsqlMeta;
    /**
     * @constructor
     * @param options - config options for query
     */
    constructor(options?: QueryOptions);
    /**
     * Query in pool instance
     * @param pool poll of connection
     * @param sql
     * @param values
     */
    poolQuery(pool: mariadb.Pool, sql: string | mariadb.QueryOptions, values?: any): Promise<any>;
    /**
     * Query in pool instance
     * @param pool poll of connection
     * @param sql sql string or object
     * @param values object of values
     */
    poolQueryStream(pool: mariadb.Pool, sql: string | mariadb.QueryOptions, values?: any): Promise<import("stream").Readable>;
    /**
     * Query in pool instance
     * @param pool poll of connection
     * @param sql sql string or object
     * @param values object of values
     */
    poolBatch(pool: mariadb.Pool, sql: string | mariadb.QueryOptions, values?: any): Promise<mariadb.UpsertResult[]>;
    /**
     * Insert single request and release
     * @param pool poll of connection
     * @param table name
     * @param params object of values
     * @param options
     */
    poolInsert(pool: mariadb.Pool, table: string, params: Record<string, any> | Array<Record<string, any>>, options?: InsertOptions): Promise<any[] | mariadb.UpsertResult | mariadb.UpsertResult[]>;
    /**
     * Update single request and release
     * @param pool poll of connection
     * @param table name
     * @param where string of where
     * @param params object of values
     * @param options
     */
    poolUpdate(pool: mariadb.Pool, table: string, where: string, params: Record<string, any>, options?: {
        ignore?: boolean;
    }): Promise<mariadb.UpsertResult>;
    /**
     * Set connection object
     * @param connection
     * @private
     */
    private _setConnection;
    /**
     * Proxy connection
     * @param connection
     */
    proxy(connection: mariadb.Connection | mariadb.PoolConnection): Connection;
    /**
     * Request query
     * @param sql - string sql query
     * @param values - object values for prepared _buildmsqlQueries
     * @returns result set of query
     */
    query(sql: string | mariadb.QueryOptions, values?: any): Promise<any>;
    /**
     * Request query streem
     * @param sql - string sql query
     * @param values - object values for prepared _buildmsqlQueries
     * @returns result set of query
     */
    queryStream(sql: string | mariadb.QueryOptions, values?: any): import("stream").Readable;
    /**
     * Request query batch
     * @param sql - string sql query
     * @param values - object values for prepared _buildmsqlQueries
     * @returns result set of query
     */
    batch(sql: string | mariadb.QueryOptions, values?: any): Promise<mariadb.UpsertResult[]>;
    /**
     * Get last metadata
     */
    getMeta(): Array<MetadataResultSet> | mariadb.UpsertResult | Array<mariadb.UpsertResult>;
    /**
     * Get last insert id
     */
    lastInsertId(): number | undefined;
    /**
     * Get affected Row
     */
    affectedRows(): number | undefined;
    /**
     * Get warring status
     */
    warningStatus(): number | undefined;
    /**
     * escape input values
     * @param input
     */
    quote(input: any): string;
    /**
     * Insert|Replace [RETURNING]
     * @param table
     * @param params
     * @param options
     */
    insert(table: string, params: Record<string, any> | Array<Record<string, any>>, options?: InsertOptions): Promise<mariadb.UpsertResult | Array<mariadb.UpsertResult> | Array<any>>;
    /**
     * Update data in table
     * @param table table name
     * @param where string for where clouse
     * @param params object input values
     * @param options
     */
    update(table: string, where: string, params: Record<string, any>, options?: {
        ignore?: boolean;
    }): Promise<mariadb.UpsertResult>;
    /**
     * Get query statistics
     * @returns _buildmsqlQueries statistics
     */
    statistics(): {
        count: number;
        time: number;
        queries: Array<QueriesInfo>;
    };
    /**
     * Start add debug info
     * @param sql - sql text
     * @param values - prepared values object or array
     */
    private _debugStart;
    /**
     * End add debug info
     */
    private _debugEnd;
}
export {};
