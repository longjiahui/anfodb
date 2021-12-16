<script setup>
// import DB from '../../src/db'
// let db = new DB({
//   db: 'test',
//   stores: {
//     testdedf: {
//       keyPath: 'id',
//       autoIncrement: true,
//       indexes: [
//         ['helloha', 'hellod', {
//           multiEntry: false,
//         }],
//       ]
//     }
//   }
// })

// db.store('testdedf').put({id: 1,a: 12, b: 123})
import DB from '../../src/db'
window.DB = DB
let db = await(new DB({
    db: 'test',
    debug: 'debug',
    stores: {test: {keyPath: 'id'}}
}).init())
let db1 = await db.open()
let db2 = await db.open()
console.log(db1, db2)
</script>

<template>
</template>

<style>
</style>
