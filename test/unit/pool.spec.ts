import {expect} from "chai";
import fs from "fs/promises";
import {Query, mariadb, Connection} from "@/index";

const table = "buildmsqltest";
let connection: Connection;
let pool: mariadb.Pool;
let qb: Query;

/**
 * Init connection
 * Create table
 */
before(async() => {
    const config = JSON.parse(
        Buffer.from(
            await fs.readFile("./connect.json")
        ).toString()
    );
    qb = new Query({debug:1});
    pool = qb.createPool({...config.db.home});

    await qb.poolQuery(`
        CREATE TABLE IF NOT EXISTS ${table} (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identificatory' ,
            params JSON NULL DEFAULT NULL COMMENT 'JSON params' , PRIMARY KEY (id)
        ) ENGINE = InnoDB COMMENT = 'test table for buildmsql';
    `);
});

/**
 * Clean table before every test
 */
beforeEach(async() => {
    await qb.poolQuery(`TRUNCATE ${table};`);
})

describe("Init testing schema - pool", () => {
    it("Test creating table test", async() => {
        const rows = await qb.poolQuery(`SHOW TABLES LIKE '${table}';`);
        expect(rows.length).to.equal(1);
    });
});

describe("query", () => {
    it("Insert", async() => {
        await qb.poolQuery({
            sql:`INSERT INTO ${table} (params) VALUES (:test)`,
            namedPlaceholders: true
        }, {test: {p: 1}});
        expect(qb.lastInsertId()).to.be.a("number", "last insert id is not a number");
        expect(qb.affectedRows()).to.equal(1, "affected rows is not a number");
        expect(qb.warningStatus()).to.equal(0, "waring status rows is not a number");
    });
    it("statistics", async() => {
        await qb.poolQuery({
            sql:`INSERT INTO ${table} (params) VALUES (:test)`,
            namedPlaceholders: true
        }, {test: {p: 1}});
        const statistics  = qb.statistics();
        expect(statistics.time).be.a("number", "statistics time is not a number");
        expect(statistics.count).be.a("number", "statistics count is not a number");
        expect(statistics.queries).be.a("array", "statistics queries is not an array");
    });
});

describe("batch", async() => {
    it("Insert", async() => {
        await qb.poolBatch({
            sql: `INSERT INTO ${table} (params) VALUES (:params)`,
            namedPlaceholders: true
        }, [
            {params: {p:1}},
            {params: {p:2}}]
        );
        const rows = await qb.poolQuery(`SELECT * FROM ${table};`);
        expect(rows.length).to.equal(2);
    });
});

describe("Insert", () => {
    it("Insert", async() => {
        await qb.poolInsert(table, {
            "params": {p:1}
        });
        const id = qb.lastInsertId();
        expect(id).to.be.a("number", "last insert id is not a number");
        const row = (await qb.poolQuery({
                    sql: `SELECT * FROM ${table} WHERE id = :id`,
                    namedPlaceholders: true
                },
                {id})
        )?.[0];
        expect(row.id).to.equal(id, `id is missing`);
        expect(row.params).to.eql({p: 1}, `params is missing`);
    });
    it("Replace", async() => {
        await qb.poolInsert(table, {
            "params": {p:2}
        }, {replace: true});
        const id = qb.lastInsertId();
        expect(id).to.be.a("number", "last insert id is not a number");
        const row = (await qb.poolQuery({
                    sql: `SELECT * FROM ${table} WHERE id = :id`,
                    namedPlaceholders: true
                },
                {id})
        )?.[0];
        expect(row.id).to.equal(id, `id is missing`);
        expect(row.params).to.eql({p: 2}, `params is missing`);
    });
    it("Insert ignore", async() => {
        await qb.poolInsert(table, {
            id: 1,
            "params": {p:1}
        });
        const id = qb.lastInsertId();
        await qb.poolInsert(table, {
            id: 1,
            "params": {p:2}
        }, {ignore: true});
        expect(id).to.be.a("number", "last insert id is not a number");
        const row = (await qb.poolQuery({
                    sql: `SELECT * FROM ${table} WHERE id = :id`,
                    namedPlaceholders: true
                },
                {id})
        )?.[0];
        expect(row.id).to.equal(id, `id is missing`);
        expect(row.params).to.eql({p: 1}, `params is missing`);
    });
    it("Insert on duplicate key update", async() => {
        await qb.poolInsert(table, {
            id: 1,
            "params": {p:1}
        });
        const id = qb.lastInsertId();
        await qb.poolInsert(table, {
            id: 1,
            "params": {p:2}
        }, {duplicate: ["params"]});
        expect(id).to.be.a("number", "last insert id is not a number");
        const row = (await qb.poolQuery({
                    sql: `SELECT * FROM ${table} WHERE id = :id`,
                    namedPlaceholders: true
                },
                {id})
        )?.[0];
        expect(row.id).to.equal(id, `id is missing`);
        expect(row.params).to.eql({p: 2}, `params is missing`);
    });
    it("Insert on duplicate key update all", async() => {
        await qb.poolInsert(table, {
            id: 1,
            "params": {p:1}
        });
        const id = qb.lastInsertId();
        await qb.poolInsert(table, {
            id: 1,
            "params": {p:2}
        }, {duplicate: true});
        expect(id).to.be.a("number", "last insert id is not a number");
        const row = (await qb.poolQuery({
                    sql: `SELECT * FROM ${table} WHERE id = :id`,
                    namedPlaceholders: true
                },
                {id})
        )?.[0];
        expect(row.id).to.equal(id, `id is missing`);
        expect(row.params).to.eql({p: 2}, `params is missing`);
    });
    it("Insert batch", async() => {
        await qb.poolInsert(table, [
            {
                id: 1,
                params: {p:1}
            },
            {
                id: 2,
                params: {p:2}
            }
        ]);
        const rows = await qb.poolQuery({
                    sql: `SELECT * FROM ${table}`,
                    namedPlaceholders: true
                });
        expect(rows.length).to.equal(2, `record is missing`);
    });
    it("Replace batch", async() => {
        await qb.poolInsert(table, [
            {
                id: 1,
                params: {p:1}
            },
            {
                id: 2,
                params: {p:2}
            }
        ], {replace: true});
        const rows = await qb.poolQuery({
            sql: `SELECT * FROM ${table}`,
            namedPlaceholders: true
        });
        expect(rows.length).to.equal(2, `record is missing`);
    });
    it("Insert batch on duplicate key update", async() => {
        await qb.poolInsert(table, [
            {
                id: 1,
                params: {p:1}
            },
            {
                id: 2,
                params: {p:2}
            }
        ], {duplicate: true});
        const rows = await qb.poolQuery({
            sql: `SELECT * FROM ${table}`,
            namedPlaceholders: true
        });
        expect(rows.length).to.equal(2, `record is missing`);
    });
    it("Replace returning", async() => {
        const rows = await qb.poolInsert(table,
            {
                id: 1,
                params: {p:1}
            }, {replace: true, returning: true});
        const resultSet: Array<any> = rows as Array<any>;
        expect(resultSet.length).to.equal(1, `record is missing`);
    });
    it("Insert batch on duplicate key update", async() => {
        await qb.poolInsert(table, [
            {
                id: 1,
                params: {p:1}
            },
            {
                id: 2,
                params: {p:2}
            },
            {
                id: 3,
                params: {p:3}
            },
            {
                id: 4,
                params: {p:4}
            }
        ], {duplicate: true, chunk: 2});
        const rows = await qb.poolQuery({
            sql: `SELECT * FROM ${table}`,
            namedPlaceholders: true
        });
        expect(rows.length).to.equal(4, `record is missing`);
    });
});

describe("Update", () => {
    it("Update row", async() => {
        await qb.poolQuery({
            sql:`INSERT INTO ${table} (params) VALUES (:test)`,
            namedPlaceholders: true
        }, {test: {p: 1}});
        const id = qb.lastInsertId();
        await qb.poolUpdate(table, "id = :id", {id, params: {p: 2}});
        const row = (await qb.query({
                    sql: `SELECT * FROM ${table} WHERE id = :id`,
                    namedPlaceholders: true
                },
            {id})
        )?.[0];
        expect(row.id).to.equal(id, `id is missing`);
        expect(row.params).to.eql({p: 2}, `params is missing`);
    })
});

/**
 * Drop table after all
 * Connection end
 */
after(async() => {
    await qb.poolQuery(`
        DROP TABLE IF EXISTS ${table};
    `);
    const pool = qb.getPool();
    await pool.end();
});