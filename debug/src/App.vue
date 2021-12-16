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
// let db = await(new DB({
//     db: 'test',
//     debug: 'debug',
//     stores: {testa: {keyPath: 'id'}}
// }).init())
// console.log('here')
// db.open(db=>console.log(db))
// console.log('there')
// indexedDB.deleteDatabase('test').onsuccess = e=>console.log(e)
</script>

<template>
</template>

<style>
</style>
