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

```typescript

import {Query, QueryOptions} from "buildmsql";
import mariadb from "mariadb";

const qb = new Query({
    // QueryOpinions
})

const connection = qb.proxy(await mariadb.createConnection({
    host: 'mydb.com',
    user:'myUser',
    password: 'myPwd'
}));

```