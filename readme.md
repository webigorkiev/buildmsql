<h1 align="center"> buildmsql </h1>
<p align="center">
  <b>buildmsql is a builder sql for mariadb connector</b>
</p>

## Description
buildmsql helps you build sql for mariadb connector

## Installation

```bash
npm i buildmsql
```

## Usage
### Single connection

```typescript

import {Query, QueryOptions} from "buildmsql";

const db = new Query(opt as {
    // QueryOpinions
    // Debug level: 0 - no debag info, 1 - _buildmsqlQueries text and timing
    debug?: 0|1,

    // Used for manticore search
    nativeTransactions?: boolean,

    // pattern *string* regex pattern to select pools. Example, `"slave*"`. default `'*'`
    pattern?:string,

    // *string* pools selector. Can be 'RR' (round-robin),
    // 'RANDOM' or 'ORDER' (use in sequence = always use first pools unless fails)
    selector?: "RR"|"RANDOM"|"ORDER"
})

const connection = await db.createConnection({
    host: 'mydb.com',
    user:'myUser',
    password: 'myPwd'
    
    // mariadb.ConnectionConfig
});

```

### Pool

```typescript
import {Query, QueryOptions} from "buildmsql";

const db = new Query({
    // QueryOpinions
})

const pool = db.createPool({
    // mariadb.PoolConfig
})

```