import {expect} from "chai";
import * as fs from "fs/promises";
// @ts-ignore
import {Query, mariadb} from "@/index";

const table = "buildmsqltest";
let cluster: mariadb.PoolCluster;
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
    cluster = qb.createPoolCluster();
    cluster.add("master", {...config.db.home})

    await qb.clusterQuery(`
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
    await qb.clusterQuery(`TRUNCATE ${table};`);
})

describe("Init testing schema - cluster", () => {
    it("Test creating table test", async() => {
        const rows = await qb.clusterQuery(`SHOW TABLES LIKE '${table}';`);
        expect(rows.length).to.equal(1);
    });
});

describe("cluster query", () => {
    it("Insert", async() => {
        await qb.clusterQuery({
            sql:`INSERT INTO ${table} (params) VALUES (:test)`,
            namedPlaceholders: true
        }, {test: {p: 1}});
        expect(qb.lastInsertId()).to.be.a("number", "last insert id is not a number");
        expect(qb.affectedRows()).to.equal(1, "affected rows is not a number");
        expect(qb.warningStatus()).to.equal(0, "waring status rows is not a number");
    });
    it("cluster statistics", async() => {
        await qb.clusterQuery({
            sql:`INSERT INTO ${table} (params) VALUES (:test)`,
            namedPlaceholders: true
        }, {test: {p: 1}});
        const statistics  = qb.statistics();
        expect(statistics.time).be.a("number", "statistics time is not a number");
        expect(statistics.count).be.a("number", "statistics count is not a number");
        expect(statistics.queries).be.a("array", "statistics queries is not an array");
    });
});

describe("cluster batch", async() => {
    it("Insert", async() => {
        await qb.clusterBatch({
            sql: `INSERT INTO ${table} (params) VALUES (:params)`,
            namedPlaceholders: true
        }, [
            {params: {p:1}},
            {params: {p:2}}]
        );
        const rows = await qb.clusterQuery(`SELECT * FROM ${table};`);
        expect(rows.length).to.equal(2);
    });
});

describe("cluster Insert", () => {
    it("Insert", async() => {
        await qb.clusterInsert(table, {
            "params": {p:1}
        });
        const id = qb.lastInsertId();
        expect(id).to.be.a("number", "last insert id is not a number");
        const row = (await qb.clusterQuery({
                    sql: `SELECT * FROM ${table} WHERE id = :id`,
                    namedPlaceholders: true
                },
                {id})
        )?.[0];
        expect(row.id).to.equal(id, `id is missing`);
        expect(row.params).to.eql({p: 1}, `params is missing`);
    });
    it(" [select] from pull then insert by connection", async() => {
        await qb.clusterQuery({
                sql: `SELECT * FROM ${table} WHERE id = :id`,
                namedPlaceholders: true
            },
            {id: 1}
        );
        const connection = await qb.getConnectionCluster();
        try {
            await connection.insert(table, {
                "params": {p: 1}
            });
            const last = connection.lastInsertId();
            expect(last).to.be.a("number", "last insert id is not a number");
        } finally {
            await connection.release();
        }
    })
    it("Replace", async() => {
        await qb.clusterInsert(table, {
            "params": {p:2}
        }, {replace: true});
        const id = qb.lastInsertId();
        expect(id).to.be.a("number", "last insert id is not a number");
        const row = (await qb.clusterQuery({
                    sql: `SELECT * FROM ${table} WHERE id = :id`,
                    namedPlaceholders: true
                },
                {id})
        )?.[0];
        expect(row.id).to.equal(id, `id is missing`);
        expect(row.params).to.eql({p: 2}, `params is missing`);
    });
    it("Insert ignore", async() => {
        await qb.clusterInsert(table, {
            id: 1,
            "params": {p:1}
        });
        const id = qb.lastInsertId();
        await qb.clusterInsert(table, {
            id: 1,
            "params": {p:2}
        }, {ignore: true});
        expect(id).to.be.a("number", "last insert id is not a number");
        const row = (await qb.clusterQuery({
                    sql: `SELECT * FROM ${table} WHERE id = :id`,
                    namedPlaceholders: true
                },
                {id})
        )?.[0];
        expect(row.id).to.equal(id, `id is missing`);
        expect(row.params).to.eql({p: 1}, `params is missing`);
    });
    it("Insert on duplicate key update", async() => {
        await qb.clusterInsert(table, {
            id: 1,
            "params": {p:1}
        });
        const id = qb.lastInsertId();
        await qb.clusterInsert(table, {
            id: 1,
            "params": {p:2}
        }, {duplicate: ["params"]});
        expect(id).to.be.a("number", "last insert id is not a number");
        const row = (await qb.clusterQuery({
                    sql: `SELECT * FROM ${table} WHERE id = :id`,
                    namedPlaceholders: true
                },
                {id})
        )?.[0];
        expect(row.id).to.equal(id, `id is missing`);
        expect(row.params).to.eql({p: 2}, `params is missing`);
    });
    it("Insert on duplicate key update all", async() => {
        await qb.clusterInsert(table, {
            id: 1,
            "params": {p:1}
        });
        const id = qb.lastInsertId();
        await qb.clusterInsert(table, {
            id: 1,
            "params": {p:2}
        }, {duplicate: true});
        expect(id).to.be.a("number", "last insert id is not a number");
        const row = (await qb.clusterQuery({
                    sql: `SELECT * FROM ${table} WHERE id = :id`,
                    namedPlaceholders: true
                },
                {id})
        )?.[0];
        expect(row.id).to.equal(id, `id is missing`);
        expect(row.params).to.eql({p: 2}, `params is missing`);
    });
    it("Insert batch", async() => {
        await qb.clusterInsert(table, [
            {
                id: 1,
                params: {p:1}
            },
            {
                id: 2,
                params: {p:2}
            }
        ]);
        const rows = await qb.clusterQuery({
                    sql: `SELECT * FROM ${table}`,
                    namedPlaceholders: true
                });
        expect(rows.length).to.equal(2, `record is missing`);
    });
    it("Replace batch", async() => {
        await qb.clusterInsert(table, [
            {
                id: 1,
                params: {p:1}
            },
            {
                id: 2,
                params: {p:2}
            }
        ], {replace: true});
        const rows = await qb.clusterQuery({
            sql: `SELECT * FROM ${table}`,
            namedPlaceholders: true
        });
        expect(rows.length).to.equal(2, `record is missing`);
    });
    it("Insert batch on duplicate key update", async() => {
        await qb.clusterInsert(table, [
            {
                id: 1,
                params: {p:1}
            },
            {
                id: 2,
                params: {p:2}
            }
        ], {duplicate: true});
        const rows = await qb.clusterQuery({
            sql: `SELECT * FROM ${table}`,
            namedPlaceholders: true
        });
        expect(rows.length).to.equal(2, `record is missing`);
    });
    it("Replace returning", async() => {
        const rows = await qb.clusterInsert(table,
            {
                id: 1,
                params: {p:1}
            }, {replace: true, returning: true});
        const resultSet: Array<any> = rows as Array<any>;
        expect(resultSet.length).to.equal(1, `record is missing`);
    });
    it("Insert batch on duplicate key update", async() => {
        await qb.clusterInsert(table, [
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
        const rows = await qb.clusterQuery({
            sql: `SELECT * FROM ${table}`,
            namedPlaceholders: true
        });
        expect(rows.length).to.equal(4, `record is missing`);
    });
});

describe("cluster Update", () => {
    it("Update row", async() => {
        await qb.clusterQuery({
            sql:`INSERT INTO ${table} (params) VALUES (:test)`,
            namedPlaceholders: true
        }, {test: {p: 1}});
        const id = qb.lastInsertId();
        await qb.clusterUpdate(table, "id = :id", {id, params: {p: 2}});
        const row = (await qb.clusterQuery({
                    sql: `SELECT * FROM ${table} WHERE id = :id`,
                    namedPlaceholders: true
                },
            {id})
        )?.[0];
        expect(row.id).to.equal(id, `id is missing`);
        expect(row.params).to.eql({p: 2}, `params is missing`);
    })
});

describe("cluster query stream", () => {
    it("stream select", async() => {
        await qb.clusterInsert(table, [
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
        ]);
        const stream = await qb.clusterQueryStream(`
            SELECT * FROM ${table};
        `);
        await new Promise(resolve => {
           stream
               .on("data", (row) => {
                   expect(typeof row.id === "number").to.equal(true);
               })
               .on("end", () => {
                   resolve(true);
               })
        });
    });
});

/**
 * Drop table after all
 * Connection end
 */
after(async() => {
    // await qb.poolQuery(`
    //     DROP TABLE IF EXISTS ${table};
    // `);
    const cluster = qb.getCluster();
    await cluster.end();
});